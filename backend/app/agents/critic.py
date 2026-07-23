"""Critic Agent -- chain-of-verification over all other agents' outputs.

Rather than trusting agent outputs, the Critic independently re-reads actual
source chunks and verifies claims against them. It scores each output 0.0-1.0,
flags low-confidence findings for human review, and quarantines hallucinated
content. This is Atlas's implementation of the "Steer" phase of Infosys's
Scan-Shield-Steer (AI3S) framework.
"""

import logging

from app.agents.base import GuardedLLMResult, extract_json, guarded_complete
from app.agents.state import AtlasState
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient
from app.parser.embedder import query_similar_chunks

logger = logging.getLogger("atlas.agents.critic")

SYSTEM_PROMPT = """You are the Critic Agent performing chain-of-verification.
You are given other agents' outputs AND independently-retrieved source code.
Verify each claim against the actual code. Penalize claims not supported by the
retrieved code. Output ONLY a JSON object with numeric quality scores."""

USER_PROMPT_TEMPLATE = """Verify these agent outputs against the independently-retrieved source code below.

=== INDEPENDENTLY RETRIEVED SOURCE CODE ===
{verification_context}

=== DOCUMENTATION OUTPUT (excerpt) ===
{documentation}

=== DECOMPOSITION SERVICES ===
{decomposition}

=== GENERATED TESTS (summary) ===
{tests}

=== SECURITY FINDINGS (summary) ===
{security}

Return a JSON object with exactly these keys:
{{
  "documentation_quality": <float 0-1>,
  "documentation_corrections": ["<specific inaccuracies found>"],
  "decomposition_quality": <float 0-1>,
  "tests_quality": <float 0-1>,
  "tests_corrections": ["<syntax/import problems>"],
  "security_quality": <float 0-1>,
  "flagged_findings": ["<finding titles needing human review>"],
  "overall_confidence": <float 0-1>,
  "recommendations": ["<actionable next steps>"]
}}"""


def _verification_context(repository_id: str) -> str:
    """Independently re-retrieve source (the core of chain-of-verification)."""
    blocks = []
    for query in ["main logic", "data access and queries", "authentication and authorization"]:
        for hit in query_similar_chunks(repository_id, query, top_k=2):
            meta = hit["metadata"]
            blocks.append(
                f"`{meta.get('file_path')}` `{meta.get('symbol_name')}`:\n```\n{hit['content'][:800]}\n```"
            )
    return "\n\n".join(blocks) if blocks else "No source available for verification."


def _default_critique() -> dict:
    return {
        "documentation_quality": 0.5,
        "documentation_corrections": [],
        "decomposition_quality": 0.5,
        "tests_quality": 0.5,
        "tests_corrections": [],
        "security_quality": 0.5,
        "flagged_findings": [],
        "overall_confidence": 0.5,
        "recommendations": ["Critic output unavailable; manual review recommended."],
        "_fallback": True,
    }


async def run_critic(
    state: AtlasState, llm_client: AtlasLLMClient, gateway: GuardrailGateway
) -> tuple[dict, GuardedLLMResult | None]:
    decomposition = state.get("decomposition_output", {})
    services = [s.get("name") for s in decomposition.get("services", [])]
    tests = state.get("generated_tests", [])
    security = state.get("security_output", [])

    user_prompt = USER_PROMPT_TEMPLATE.format(
        verification_context=_verification_context(state.get("repository_id", "")),
        documentation=(state.get("documentation_output", "") or "")[:2500],
        decomposition=", ".join(filter(None, services)) or "none",
        tests=f"{len(tests)} test files covering "
        + ", ".join(t.get("source_file", "") for t in tests[:5]),
        security="; ".join(f.get("title", "") for f in security[:8]) or "none",
    )

    result = await guarded_complete(
        llm_client=llm_client,
        gateway=gateway,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_type="critic",
        known_file_paths=set(state.get("known_file_paths", [])),
        known_function_names=set(state.get("known_function_names", [])),
        max_tokens=1800,
        job_id=state.get("job_id"),
    )

    if result.blocked:
        return _default_critique(), result

    parsed = extract_json(result.content)
    if not isinstance(parsed, dict):
        return _default_critique(), result

    return parsed, result
