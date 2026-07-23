"""LangGraph pipeline: parse -> embed -> static analysis -> planner ->
parallel[documentation, decomposition, test_generator, security] -> critic ->
evaluator -> report.

LangGraph (rather than a plain loop) gives explicit state persistence and
checkpointing: if a job dies mid-Decomposition, it resumes from that
checkpoint instead of restarting the whole analysis -- important for
long-running jobs against real enterprise-sized codebases.
"""

import logging
import time

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from app.agents.critic import run_critic
from app.agents.decomposition import run_decomposition
from app.agents.documentation import run_documentation
from app.agents.evaluator import run_evaluator
from app.agents.planner import run_planner
from app.agents.security import run_security
from app.agents.state import AtlasState
from app.agents.test_generator import run_test_generator
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient
from app.parser.ast_parser import parse_file
from app.parser.call_graph import build_call_graph, compute_module_coupling, file_has_entry_point
from app.parser.chunker import chunk_file
from app.parser.embedder import embed_chunks
from app.parser.languages import detect_language
from app.parser.metrics import compute_file_metrics
from app.static_analysis.bandit_runner import run_bandit
from app.static_analysis.semgrep_runner import run_semgrep

logger = logging.getLogger("atlas.agents.graph")

SOURCE_EXTENSIONS = (".py", ".java", ".js", ".jsx")
IGNORED_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", "dist", "build", "target"}


def _agent_bookkeeping(agent_type: str, llm_result, started_at: float) -> dict:
    """Returns ONLY this node's own delta for the merged/reducer-backed state fields.

    Must not include anything read from the inherited state -- when the four
    parallel agents each return their update, LangGraph sums same-key numeric
    values across branches (see state.py's _merge_dicts / operator.add). If a
    node included inherited values in what it returns, that inherited amount
    would get summed once per parallel branch and wildly overcounted.
    """
    update: dict = {"execution_times": {agent_type: round(time.monotonic() - started_at, 3)}}

    if llm_result is not None:
        update["token_usage"] = {llm_result.model_id: llm_result.tokens_used}
        update["rate_limit_hits"] = llm_result.rate_limit_hits
        update["guardrail_flags"] = [
            {
                "agent_type": agent_type,
                "check_type": event.check_type,
                "action_taken": event.action_taken,
                "confidence": event.confidence,
                "details": event.details,
            }
            for event in llm_result.guardrail_events
        ]
    else:
        update["rate_limit_hits"] = 0
        update["guardrail_flags"] = []

    return update


def _get_llm_client(state: AtlasState) -> AtlasLLMClient:
    return AtlasLLMClient(token_budget=state.get("token_budget"))


def _get_gateway(state: AtlasState) -> GuardrailGateway:
    return GuardrailGateway(token_budget=state.get("token_budget", 50_000))


async def parse_repository_node(state: AtlasState) -> AtlasState:
    import os

    repo_path = state["repository_path"]
    parse_results = []

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for filename in files:
            if not filename.endswith(SOURCE_EXTENSIONS):
                continue
            full_path = os.path.join(root, filename)
            rel_path = os.path.relpath(full_path, repo_path).replace("\\", "/")
            try:
                with open(full_path, encoding="utf-8", errors="replace") as f:
                    source = f.read()
            except OSError as exc:
                logger.warning("Could not read %s: %s", full_path, exc)
                continue
            parse_results.append((rel_path, source, parse_file(rel_path, source)))

    code_files = []
    complexity_metrics = {}
    known_functions: set[str] = set()

    for rel_path, source, parsed in parse_results:
        metrics = compute_file_metrics(parsed)
        code_files.append(
            {
                "file_path": rel_path,
                "language": parsed.language,
                "loc": parsed.total_loc,
                "function_count": len(parsed.functions),
                "class_count": len(parsed.classes),
                "is_entry_point": file_has_entry_point(parsed),
            }
        )
        complexity_metrics[rel_path] = {
            "cyclomatic_complexity": metrics.cyclomatic_complexity,
            "coupling_score": metrics.coupling_score,
            "cohesion_score": metrics.cohesion_score,
            "technical_debt_minutes": metrics.technical_debt_minutes,
            "function_complexities": [
                {"name": fc.name, "cyclomatic_complexity": fc.cyclomatic_complexity}
                for fc in metrics.function_complexities
            ],
        }
        for fn in parsed.functions:
            known_functions.add(fn.name)
            for fc in complexity_metrics[rel_path]["function_complexities"]:
                if fc["name"] == fn.name:
                    fc["source"] = fn.body_text

    all_parsed = [p for _, _, p in parse_results]
    edges = build_call_graph(all_parsed)
    coupling = compute_module_coupling(all_parsed, edges)
    for path, score in coupling.items():
        complexity_metrics.setdefault(path, {})["coupling_score"] = score

    call_graph = {
        "edges": [
            {
                "caller_file": e.caller_file,
                "caller_function": e.caller_function,
                "callee_file": e.callee_file,
                "callee_function": e.callee_function,
            }
            for e in edges
        ]
    }
    primary_language = (
        detect_language(code_files[0]["file_path"]) if code_files else state.get("primary_language", "python")
    )

    return {
        "code_files": code_files,
        "complexity_metrics": complexity_metrics,
        "call_graph": call_graph,
        "known_file_paths": [f["file_path"] for f in code_files],
        "known_function_names": list(known_functions),
        "primary_language": primary_language,
        # Private, non-reducer field: hands parsed ASTs to embed_chunks_node without
        # re-parsing. Never read by anything downstream of that node.
        "_parse_results": parse_results,
    }


async def embed_chunks_node(state: AtlasState) -> dict:
    parse_results = state.get("_parse_results", [])
    all_chunks = []
    for rel_path, source, parsed in parse_results:
        all_chunks.extend(chunk_file(parsed, source))

    if all_chunks:
        embed_chunks(state["repository_id"], state["job_id"], all_chunks)

    return {"_parse_results": []}


async def static_analysis_node(state: AtlasState) -> dict:
    repo_path = state["repository_path"]
    findings = []

    for f in run_bandit(repo_path):
        findings.append(f.__dict__)
    for f in run_semgrep(repo_path):
        findings.append(f.__dict__)

    return {"static_findings": findings}


async def planner_node(state: AtlasState) -> dict:
    llm_client, gateway = _get_llm_client(state), _get_gateway(state)
    started = time.monotonic()
    output, llm_result = await run_planner(state, llm_client, gateway)
    return {"planner_output": output, **_agent_bookkeeping("planner", llm_result, started)}


async def documentation_node(state: AtlasState) -> dict:
    llm_client, gateway = _get_llm_client(state), _get_gateway(state)
    started = time.monotonic()
    output, llm_result = await run_documentation(state, llm_client, gateway)
    return {"documentation_output": output, **_agent_bookkeeping("documentation", llm_result, started)}


async def decomposition_node(state: AtlasState) -> dict:
    llm_client, gateway = _get_llm_client(state), _get_gateway(state)
    started = time.monotonic()
    output, llm_result = await run_decomposition(state, llm_client, gateway)
    return {"decomposition_output": output, **_agent_bookkeeping("decomposition", llm_result, started)}


async def test_generator_node(state: AtlasState) -> dict:
    llm_client, gateway = _get_llm_client(state), _get_gateway(state)
    started = time.monotonic()
    output, llm_result = await run_test_generator(state, llm_client, gateway)
    return {"generated_tests": output, **_agent_bookkeeping("test_generator", llm_result, started)}


async def security_node(state: AtlasState) -> dict:
    llm_client, gateway = _get_llm_client(state), _get_gateway(state)
    started = time.monotonic()
    output, llm_result = await run_security(state, llm_client, gateway)
    return {"security_output": output, **_agent_bookkeeping("security", llm_result, started)}


async def critic_node(state: AtlasState) -> dict:
    llm_client, gateway = _get_llm_client(state), _get_gateway(state)
    started = time.monotonic()
    output, llm_result = await run_critic(state, llm_client, gateway)
    return {"critic_output": output, **_agent_bookkeeping("critic", llm_result, started)}


async def evaluator_node(state: AtlasState) -> dict:
    llm_client, gateway = _get_llm_client(state), _get_gateway(state)
    started = time.monotonic()
    output, llm_result = await run_evaluator(state, llm_client, gateway)
    return {"evaluation_output": output, **_agent_bookkeeping("evaluator", llm_result, started)}


async def generate_report_node(state: AtlasState) -> dict:
    final_report = {
        "documentation": state.get("documentation_output"),
        "decomposition": state.get("decomposition_output"),
        "tests": state.get("generated_tests"),
        "security": state.get("security_output"),
        "critic": state.get("critic_output"),
        "evaluation": state.get("evaluation_output"),
        # Read-only snapshot for the report; NOT re-returned as "token_usage" etc.,
        # since re-returning reducer-backed fields would sum them into themselves.
        "token_usage": dict(state.get("token_usage", {})),
        "rate_limit_hits": state.get("rate_limit_hits", 0),
        "execution_times": dict(state.get("execution_times", {})),
    }
    return {"final_report": final_report, "status": "completed"}


def build_graph():
    graph = StateGraph(AtlasState)

    graph.add_node("parse_repository", parse_repository_node)
    graph.add_node("embed_chunks", embed_chunks_node)
    graph.add_node("static_analysis", static_analysis_node)
    graph.add_node("planner", planner_node)
    graph.add_node("documentation", documentation_node)
    graph.add_node("decomposition", decomposition_node)
    graph.add_node("test_generator", test_generator_node)
    graph.add_node("security", security_node)
    graph.add_node("critic", critic_node)
    graph.add_node("evaluator", evaluator_node)
    graph.add_node("generate_report", generate_report_node)

    graph.set_entry_point("parse_repository")
    graph.add_edge("parse_repository", "embed_chunks")
    graph.add_edge("embed_chunks", "static_analysis")
    graph.add_edge("static_analysis", "planner")

    # Fan out to the four independent agents, fan back in at "critic".
    for parallel_node in ("documentation", "decomposition", "test_generator", "security"):
        graph.add_edge("planner", parallel_node)
        graph.add_edge(parallel_node, "critic")

    graph.add_edge("critic", "evaluator")
    graph.add_edge("evaluator", "generate_report")
    graph.add_edge("generate_report", END)

    return graph.compile(checkpointer=MemorySaver())


def build_graph_for_job(job_id: str):
    """Returns (compiled_graph, config) -- config carries the LangGraph thread_id for checkpointing."""
    compiled = build_graph()
    config = {"configurable": {"thread_id": job_id}}
    return compiled, config
