"""Evaluator Agent -- the eval harness (LLM-as-judge).

Scores every agent output on faithfulness, completeness, actionability, test
coverage estimate, and decomposition validity, producing numeric quality
scores. This is the differentiator: Atlas can state, with numbers, how
reliable each agent's output is.
"""

import logging

from app.agents.base import GuardedLLMResult, extract_json, guarded_complete
from app.agents.state import AtlasState
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient

logger = logging.getLogger("atlas.agents.evaluator")

SYSTEM_PROMPT = """You are the Evaluator Agent acting as an impartial LLM-as-judge.
You score the quality of automated analysis outputs on well-defined rubrics.
Be critical and calibrated -- do not give everything a high score.
Output ONLY a JSON object."""

USER_PROMPT_TEMPLATE = """Evaluate the quality of this legacy-modernization analysis.

Documentation length: {doc_len} chars
Number of components documented: {component_hint}
Decomposition: {service_count} proposed services, first extraction: {first_extraction}
Generated tests: {test_count} files, ~{functions_covered} functions covered
Security findings: {security_count} (severities: {severity_summary})
Critic overall confidence: {critic_confidence}

Score on these rubrics and return a JSON object with exactly these keys:
{{
  "faithfulness": <float 0-1, does documentation match the actual code?>,
  "completeness": <float 0-1, share of components covered>,
  "actionability": <float 0-1, are security fixes implementable?>,
  "test_coverage_estimate": <float 0-1, share of functions with tests>,
  "decomposition_validity": <float 0-1, no circular service dependencies?>,
  "overall_quality_score": <float 0-1>,
  "improvement_suggestions": ["<specific suggestions>"]
}}"""


def _default_evaluation() -> dict:
    return {
        "faithfulness": 0.5,
        "completeness": 0.5,
        "actionability": 0.5,
        "test_coverage_estimate": 0.0,
        "decomposition_validity": 0.5,
        "overall_quality_score": 0.5,
        "improvement_suggestions": ["Evaluation unavailable; scores are placeholders."],
        "_fallback": True,
    }


async def run_evaluator(
    state: AtlasState, llm_client: AtlasLLMClient, gateway: GuardrailGateway
) -> tuple[dict, GuardedLLMResult | None]:
    security = state.get("security_output", [])
    tests = state.get("generated_tests", [])
    decomposition = state.get("decomposition_output", {})
    critic = state.get("critic_output", {})

    severity_counts: dict[str, int] = {}
    for f in security:
        sev = f.get("severity", "unknown")
        severity_counts[sev] = severity_counts.get(sev, 0) + 1

    user_prompt = USER_PROMPT_TEMPLATE.format(
        doc_len=len(state.get("documentation_output", "") or ""),
        component_hint=len(state.get("code_files", [])),
        service_count=len(decomposition.get("services", [])),
        first_extraction=decomposition.get("recommended_first_extraction", "n/a"),
        test_count=len(tests),
        functions_covered=sum(len(t.get("functions_covered", [])) for t in tests),
        security_count=len(security),
        severity_summary=", ".join(f"{k}:{v}" for k, v in severity_counts.items()) or "none",
        critic_confidence=critic.get("overall_confidence", "n/a"),
    )

    result = await guarded_complete(
        llm_client=llm_client,
        gateway=gateway,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_type="evaluator",
        known_file_paths=set(state.get("known_file_paths", [])),
        known_function_names=set(state.get("known_function_names", [])),
        max_tokens=1200,
        job_id=state.get("job_id"),
    )

    if result.blocked:
        return _default_evaluation(), result

    parsed = extract_json(result.content)
    if not isinstance(parsed, dict):
        return _default_evaluation(), result

    return parsed, result
