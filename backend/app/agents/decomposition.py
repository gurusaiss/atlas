"""Decomposition Agent -- proposes a microservices breakdown using DDD + coupling.

Coupling below 0.3 between module groups indicates a natural bounded context
(external_calls / total_calls per module). The agent uses these metrics plus
the call graph to find seams -- the same "find the seams" approach Michael
Feathers describes in Working Effectively With Legacy Code.
"""

import logging

from app.agents.base import GuardedLLMResult, extract_json, guarded_complete
from app.agents.state import AtlasState
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient

logger = logging.getLogger("atlas.agents.decomposition")

SYSTEM_PROMPT = """You are the Decomposition Agent in a legacy-modernization pipeline.
You propose how to break a monolith into microservices using Domain-Driven Design.
Low coupling between module groups (< 0.3) marks a natural bounded context.
Output ONLY a JSON object, no prose outside it."""

USER_PROMPT_TEMPLATE = """Propose a microservices decomposition for this {language} system.

Files with coupling scores (path | coupling | avg complexity):
{coupling_table}

Call graph edges (caller_file -> callee_file, sampled):
{edge_sample}

Architecture documentation summary:
{doc_summary}

Return a JSON object with exactly these keys:
{{
  "services": [
    {{
      "name": "<ServiceName>",
      "responsibility": "<one sentence>",
      "files": ["<mapped file paths>"],
      "api_surface": ["<key operations>"],
      "migration_effort": "<Low|Medium|High>",
      "extract_order": <int, 1 = extract first>
    }}
  ],
  "mermaid_diagram": "graph LR\\n  ...",
  "recommended_first_extraction": "<service name with lowest coupling>",
  "risks": ["<distributed-monolith or circular-dependency risks>"],
  "estimated_total_effort_weeks": <int>
}}"""


def _coupling_table(code_files: list[dict], complexity_metrics: dict) -> str:
    rows = []
    for f in code_files:
        m = complexity_metrics.get(f["file_path"], {})
        rows.append(
            f"{f['file_path']} | {m.get('coupling_score', 0):.2f} | {m.get('cyclomatic_complexity', 0):.1f}"
        )
    return "\n".join(rows)


def _edge_sample(call_graph: dict, limit: int = 40) -> str:
    edges = call_graph.get("edges", [])
    lines = [
        f"{e.get('caller_file')} -> {e.get('callee_file')} ({e.get('callee_function')})"
        for e in edges[:limit]
        if e.get("callee_file")
    ]
    return "\n".join(lines) if lines else "No cross-file edges resolved."


def _fallback_decomposition(state: AtlasState) -> dict:
    code_files = state.get("code_files", [])
    return {
        "services": [
            {
                "name": "MonolithCore",
                "responsibility": "Existing monolith; automated decomposition unavailable.",
                "files": [f["file_path"] for f in code_files],
                "api_surface": [],
                "migration_effort": "High",
                "extract_order": 1,
            }
        ],
        "mermaid_diagram": "graph LR\n  Client --> MonolithCore",
        "recommended_first_extraction": "MonolithCore",
        "risks": ["Decomposition agent output unavailable; manual analysis required."],
        "estimated_total_effort_weeks": 12,
        "_fallback": True,
    }


async def run_decomposition(
    state: AtlasState, llm_client: AtlasLLMClient, gateway: GuardrailGateway
) -> tuple[dict, GuardedLLMResult | None]:
    code_files = state.get("code_files", [])
    complexity_metrics = state.get("complexity_metrics", {})
    doc = state.get("documentation_output", "")

    user_prompt = USER_PROMPT_TEMPLATE.format(
        language=state.get("primary_language", "unknown"),
        coupling_table=_coupling_table(code_files, complexity_metrics),
        edge_sample=_edge_sample(state.get("call_graph", {})),
        doc_summary=doc[:2000] if doc else "No documentation available.",
    )

    result = await guarded_complete(
        llm_client=llm_client,
        gateway=gateway,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_type="decomposition",
        known_file_paths=set(state.get("known_file_paths", [])),
        known_function_names=set(state.get("known_function_names", [])),
        max_tokens=2500,
        job_id=state.get("job_id"),
    )

    if result.blocked:
        return _fallback_decomposition(state), result

    parsed = extract_json(result.content)
    if not isinstance(parsed, dict) or "services" not in parsed:
        logger.warning("Decomposition returned unparseable output; using fallback")
        return _fallback_decomposition(state), result

    return parsed, result
