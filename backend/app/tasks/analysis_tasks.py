"""Celery task that runs the full Atlas agent pipeline for one job.

Wraps app.agents.graph's compiled LangGraph state machine: builds the initial
state from the Job/Repository DB rows, invokes the graph, and persists
AgentResult/Finding/Report/GuardrailEvent rows from the final state.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select

from app.agents.graph import build_graph_for_job
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.finding import Finding
from app.models.job import AgentResult, Job
from app.models.report import GuardrailEvent, Report
from app.models.repository import CallGraphEdge, CodeFile, Repository
from app.observability.metrics import (
    active_jobs,
    agent_duration_seconds,
    findings_total,
    guardrail_events_total,
    jobs_total,
    llm_tokens_total,
    rate_limit_hits_total,
)
from app.tasks.celery_app import celery_app

logger = logging.getLogger("atlas.tasks.analysis")
settings = get_settings()


async def _run_pipeline_async(job_id: str) -> None:
    async with AsyncSessionLocal() as db:
        job = await db.get(Job, job_id)
        if job is None:
            logger.error("Job %s not found", job_id)
            return

        repository = await db.get(Repository, job.repository_id)
        if repository is None:
            job.status = "failed"
            job.error_message = "Repository not found"
            await db.commit()
            return

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        await db.commit()
        active_jobs.inc()

        initial_state = {
            "job_id": str(job.id),
            "repository_id": str(repository.id),
            "repository_path": repository.upload_path,
            "primary_language": repository.primary_language or "python",
            "is_demo": job.is_demo,
            "token_budget": settings.default_token_budget,
        }

        graph, config = build_graph_for_job(str(job.id))

        # Node → (human-readable label, % progress) for real-time SSE updates.
        # Parallel nodes share the 40-65 range; each one completing advances
        # the counter so the bar moves even while others are still running.
        _NODE_PROGRESS: dict[str, tuple[str, int]] = {
            "parse_repository": ("Parsing source files", 10),
            "embed_chunks": ("Embedding code chunks", 20),
            "static_analysis": ("Running static analysis", 25),
            "planner": ("Planning analysis", 35),
            "documentation": ("Generating documentation", 47),
            "decomposition": ("Decomposing services", 55),
            "test_generator": ("Generating tests", 62),
            "security": ("Security analysis", 70),
            "critic": ("Critic review", 80),
            "evaluator": ("Evaluating quality", 90),
            "generate_report": ("Generating report", 95),
        }

        try:
            final_state = None
            async for chunk in graph.astream(initial_state, config=config, stream_mode="updates"):
                node_name = next(iter(chunk), None)
                if node_name and node_name in _NODE_PROGRESS:
                    label, pct = _NODE_PROGRESS[node_name]
                    try:
                        async with AsyncSessionLocal() as pdb:
                            pjob = await pdb.get(Job, job_id)
                            if pjob:
                                pjob.current_agent = label
                                pjob.progress = pct
                                await pdb.commit()
                    except Exception:
                        logger.warning("Progress update failed for job %s node %s", job_id, node_name)

            # After all nodes have run, read the final merged state from the checkpoint.
            state_snapshot = await graph.aget_state(config)
            final_state = state_snapshot.values
        except Exception:
            # Full exception (potentially including internals like an LLM
            # provider's request/response repr, which some SDKs do not scrub of
            # Authorization headers) goes to the server log only. job.error_message
            # is returned to the job's owner over the API, so it must never echo
            # raw exception text -- that's exactly the surface that could leak the
            # operator's shared LLM API key to an end user.
            logger.exception("Pipeline failed for job %s", job_id)
            job.status = "failed"
            job.completed_at = datetime.now(timezone.utc)
            job.error_message = "Analysis failed due to an internal error. Please try again."
            jobs_total.labels(status="failed").inc()
            await db.commit()
            active_jobs.dec()
            return

        await _persist_results(db, job, repository, final_state)

        job.status = "completed"
        job.progress = 100
        job.completed_at = datetime.now(timezone.utc)
        for model, tokens in final_state.get("token_usage", {}).items():
            job.total_tokens_used += tokens
            model_lower = model.lower()
            if "gemini" in model_lower:
                job.gemini_tokens += tokens
            elif "mistral" in model_lower or "codestral" in model_lower:
                job.mistral_tokens += tokens
            else:
                job.groq_tokens += tokens
            llm_tokens_total.labels(model=model, agent="pipeline").inc(tokens)
        job.rate_limit_hits += final_state.get("rate_limit_hits", 0)
        rate_limit_hits_total.labels(model="all").inc(final_state.get("rate_limit_hits", 0))
        jobs_total.labels(status="completed").inc()
        await db.commit()
        active_jobs.dec()


async def _persist_code_files(db, repository: Repository, state: dict) -> None:
    """Upserts CodeFile rows from the parser's output so the frontend's Metrics tab
    (complexity heatmap, coupling/cohesion scatter) has real per-file data to show."""
    code_files = state.get("code_files", [])
    complexity_metrics = state.get("complexity_metrics", {})
    if not code_files:
        return

    existing = {
        cf.file_path: cf
        for cf in (
            await db.scalars(select(CodeFile).where(CodeFile.repository_id == repository.id))
        ).all()
    }

    for f in code_files:
        metrics = complexity_metrics.get(f["file_path"], {})
        row = existing.get(f["file_path"])
        if row is None:
            row = CodeFile(repository_id=repository.id, file_path=f["file_path"])
            db.add(row)

        row.language = f.get("language")
        row.loc = f.get("loc", 0)
        row.function_count = f.get("function_count", 0)
        row.class_count = f.get("class_count", 0)
        row.is_entry_point = f.get("is_entry_point", False)
        row.cyclomatic_complexity = metrics.get("cyclomatic_complexity", 0)
        row.coupling_score = metrics.get("coupling_score", 0)
        row.cohesion_score = metrics.get("cohesion_score", 0)
        row.technical_debt_minutes = metrics.get("technical_debt_minutes", 0)
        row.parsed_at = datetime.now(timezone.utc)

    repository.total_files = len(code_files)
    repository.total_loc = sum(f.get("loc", 0) for f in code_files)
    repository.status = "ready"


async def _persist_call_graph(db, repository: Repository, state: dict) -> None:
    """Replaces this repository's call_graph_edges with the latest parse.

    Deletes-then-reinserts rather than diffing, since the call graph has no
    natural unique key to upsert against and is cheap to fully regenerate --
    it exists purely to power the frontend's call-graph viewer, not as a
    system of record.
    """
    edges = state.get("call_graph", {}).get("edges", [])

    await db.execute(delete(CallGraphEdge).where(CallGraphEdge.repository_id == repository.id))

    for e in edges:
        if e.get("callee_file") is None:
            continue  # unresolved call target -- nothing to draw an edge to
        db.add(
            CallGraphEdge(
                repository_id=repository.id,
                caller_file=e.get("caller_file"),
                caller_function=e.get("caller_function"),
                callee_file=e.get("callee_file"),
                callee_function=e.get("callee_function"),
            )
        )


async def _persist_results(db, job: Job, repository: Repository, state: dict) -> None:
    await _persist_code_files(db, repository, state)
    await _persist_call_graph(db, repository, state)

    agent_outputs = {
        "planner": (state.get("planner_output"), None),
        "documentation": (state.get("documentation_output"), None),
        "decomposition": (state.get("decomposition_output"), None),
        "test_generator": (state.get("generated_tests"), None),
        "security": (state.get("security_output"), None),
        "critic": (state.get("critic_output"), None),
        "evaluator": (state.get("evaluation_output"), None),
    }

    for agent_type, (output, _) in agent_outputs.items():
        is_markdown = isinstance(output, str)
        result = AgentResult(
            job_id=job.id,
            agent_type=agent_type,
            status="completed" if output else "skipped",
            output=output if not is_markdown else None,
            output_markdown=output if is_markdown else None,
            execution_time_seconds=state.get("execution_times", {}).get(agent_type),
            confidence_score=(state.get("critic_output", {}) or {}).get(f"{agent_type}_quality"),
        )
        db.add(result)
        await db.flush()

        if agent_type == "security" and isinstance(output, list):
            for f in output:
                finding = Finding(
                    agent_result_id=result.id,
                    job_id=job.id,
                    repository_id=repository.id,
                    finding_type=f.get("finding_type", "security"),
                    category=f.get("category"),
                    severity=f.get("severity"),
                    title=f.get("title") or "Untitled finding",
                    description=f.get("description"),
                    file_path=f.get("file_path"),
                    line_start=f.get("line_start"),
                    line_end=f.get("line_end"),
                    code_snippet=f.get("code_snippet"),
                    suggested_fix=f.get("suggested_fix"),
                    confidence=f.get("confidence", 1.0),
                    owasp_category=f.get("owasp_category"),
                    cwe_id=f.get("cwe_id"),
                    source=f.get("source", "llm"),
                    semgrep_rule_id=f.get("rule_id"),
                )
                db.add(finding)
                findings_total.labels(
                    severity=finding.severity or "unknown", category=finding.category or "unknown"
                ).inc()

    for event in state.get("guardrail_flags", []):
        db.add(
            GuardrailEvent(
                job_id=job.id,
                agent_type=event.get("agent_type"),
                check_type=event.get("check_type"),
                action_taken=event.get("action_taken"),
                confidence=event.get("confidence"),
                details=event.get("details"),
            )
        )
        guardrail_events_total.labels(
            type=event.get("check_type", "unknown"), action=event.get("action_taken", "unknown")
        ).inc()

    final_report = state.get("final_report", {})
    if final_report:
        db.add(
            Report(
                job_id=job.id,
                report_type="full_report",
                title=f"Atlas Analysis Report - {repository.name}",
                content_markdown=final_report.get("documentation"),
                content_json=final_report,
                is_demo=job.is_demo,
            )
        )

    for agent_type, seconds in state.get("execution_times", {}).items():
        agent_duration_seconds.labels(agent_type=agent_type).observe(seconds)

    await db.commit()


@celery_app.task(name="atlas.run_full_analysis", bind=True)
def run_full_analysis(self, job_id: str) -> str:
    """Celery entry point -- runs the async pipeline via a fresh event loop per task."""
    asyncio.run(_run_pipeline_async(job_id))
    return job_id
