"""Planner Agent -- triages the codebase before any expensive agent runs.

Mirrors how a senior architect approaches a legacy system: identify the
highest-coupling/highest-complexity files first, guess the business domain,
and allocate a token budget per downstream agent so trivial files don't burn
free-tier quota.
"""

import logging

from app.agents.base import GuardedLLMResult, extract_json, guarded_complete
from app.agents.state import AtlasState
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient

logger = logging.getLogger("atlas.agents.planner")

SYSTEM_PROMPT = """You are the Planner Agent in an automated legacy-modernization pipeline.
You triage a codebase and produce a structured analysis plan.
Think step by step (chain-of-thought) about complexity, coupling, and business domain,
then output ONLY a JSON object. Do not include prose outside the JSON."""

USER_PROMPT_TEMPLATE = """Analyze this repository summary and produce an analysis plan.

Primary language: {language}
Total files: {file_count}
Total lines of code: {total_loc}

Files (path | LOC | avg cyclomatic complexity | coupling score):
{file_table}

Static-analysis findings so far: {static_finding_count}

Return a JSON object with exactly these keys:
{{
  "domain": "<one of: banking, ecommerce, healthcare, logistics, generic>",
  "risk_files": ["<up to 10 highest-risk file paths, most-risky first>"],
  "analysis_priorities": ["<ordered analysis focus areas>"],
  "token_budget": {{"documentation": <int>, "decomposition": <int>, "test_generator": <int>, "security": <int>}},
  "complexity_summary": "<2-3 sentence summary>",
  "recommended_scope": "<full or focused>"
}}"""


def _build_file_table(code_files: list[dict], complexity_metrics: dict) -> str:
    rows = []
    ranked = sorted(
        code_files,
        key=lambda f: (
            complexity_metrics.get(f["file_path"], {}).get("coupling_score", 0),
            complexity_metrics.get(f["file_path"], {}).get("cyclomatic_complexity", 0),
        ),
        reverse=True,
    )
    for f in ranked[:40]:
        m = complexity_metrics.get(f["file_path"], {})
        rows.append(
            f"{f['file_path']} | {f.get('loc', 0)} | "
            f"{m.get('cyclomatic_complexity', 0):.1f} | {m.get('coupling_score', 0):.2f}"
        )
    return "\n".join(rows)


def _fallback_plan(state: AtlasState) -> dict:
    code_files = state.get("code_files", [])
    ranked = sorted(
        code_files,
        key=lambda f: state.get("complexity_metrics", {})
        .get(f["file_path"], {})
        .get("cyclomatic_complexity", 0),
        reverse=True,
    )
    return {
        "domain": "generic",
        "risk_files": [f["file_path"] for f in ranked[:10]],
        "analysis_priorities": ["security", "high_complexity_files", "documentation"],
        "token_budget": {"documentation": 15000, "decomposition": 8000, "test_generator": 12000, "security": 10000},
        "complexity_summary": "Heuristic plan (LLM unavailable): prioritized by cyclomatic complexity.",
        "recommended_scope": "full",
        "_fallback": True,
    }


async def run_planner(
    state: AtlasState, llm_client: AtlasLLMClient, gateway: GuardrailGateway
) -> tuple[dict, GuardedLLMResult | None]:
    code_files = state.get("code_files", [])
    complexity_metrics = state.get("complexity_metrics", {})

    user_prompt = USER_PROMPT_TEMPLATE.format(
        language=state.get("primary_language", "unknown"),
        file_count=len(code_files),
        total_loc=sum(f.get("loc", 0) for f in code_files),
        file_table=_build_file_table(code_files, complexity_metrics),
        static_finding_count=len(state.get("static_findings", [])),
    )

    result = await guarded_complete(
        llm_client=llm_client,
        gateway=gateway,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_type="planner",
        known_file_paths=set(state.get("known_file_paths", [])),
        known_function_names=set(state.get("known_function_names", [])),
        max_tokens=1500,
        job_id=state.get("job_id"),
    )

    if result.blocked:
        logger.warning("Planner blocked by guardrail (%s); using fallback plan", result.block_reason)
        return _fallback_plan(state), result

    parsed = extract_json(result.content)
    if not isinstance(parsed, dict):
        logger.warning("Planner returned unparseable output; using fallback plan")
        return _fallback_plan(state), result

    return parsed, result
