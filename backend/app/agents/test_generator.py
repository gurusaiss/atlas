"""Test Generation Agent -- generates runnable unit tests for untested functions.

Uses Mistral Codestral (code-specialized) which produces syntactically correct
pytest/JUnit more reliably than general-purpose models -- it understands
fixtures and annotations natively.
"""

import logging

from app.agents.base import GuardedLLMResult, extract_json, guarded_complete
from app.agents.state import AtlasState
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient

logger = logging.getLogger("atlas.agents.test_generator")

FRAMEWORK_BY_LANGUAGE = {"python": "pytest", "java": "junit5", "javascript": "jest"}

SYSTEM_PROMPT = """You are the Test Generation Agent in a legacy-modernization pipeline.
You generate runnable, syntactically-correct unit tests for the target framework.
Cover the happy path, edge cases (null/empty/boundary), and error cases. Mock
external dependencies (DB, HTTP, services). Output ONLY a JSON array."""

USER_PROMPT_TEMPLATE = """Generate unit tests using {framework} for these untested {language} functions.

{functions_block}

Return a JSON array:
[
  {{
    "source_file": "<original file path>",
    "test_file": "<suggested test file path>",
    "test_code": "<complete, runnable test file content>",
    "functions_covered": ["<function names>"],
    "framework": "{framework}"
  }}
]"""


def _select_untested_functions(state: AtlasState, limit: int = 8) -> list[dict]:
    """Pick the highest-complexity functions as test targets (best ROI on limited tokens)."""
    candidates = []
    for f in state.get("code_files", []):
        metrics = state.get("complexity_metrics", {}).get(f["file_path"], {})
        for fn in metrics.get("function_complexities", []):
            candidates.append(
                {
                    "file_path": f["file_path"],
                    "name": fn["name"],
                    "complexity": fn["cyclomatic_complexity"],
                    "source": fn.get("source", ""),
                }
            )
    candidates.sort(key=lambda c: c["complexity"], reverse=True)
    return candidates[:limit]


def _functions_block(functions: list[dict]) -> str:
    blocks = []
    for fn in functions:
        blocks.append(
            f"File `{fn['file_path']}`, function `{fn['name']}` (complexity {fn['complexity']}):\n"
            f"```\n{fn.get('source', '')[:800]}\n```"
        )
    return "\n\n".join(blocks)


async def run_test_generator(
    state: AtlasState, llm_client: AtlasLLMClient, gateway: GuardrailGateway
) -> tuple[list[dict], GuardedLLMResult | None]:
    language = state.get("primary_language", "python")
    framework = FRAMEWORK_BY_LANGUAGE.get(language, "pytest")
    targets = _select_untested_functions(state)

    if not targets:
        return [], None

    user_prompt = USER_PROMPT_TEMPLATE.format(
        framework=framework, language=language, functions_block=_functions_block(targets)
    )

    result = await guarded_complete(
        llm_client=llm_client,
        gateway=gateway,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_type="test_generator",
        known_file_paths=set(state.get("known_file_paths", [])),
        known_function_names=set(state.get("known_function_names", [])),
        max_tokens=3500,
        job_id=state.get("job_id"),
    )

    if result.blocked:
        return [], result

    parsed = extract_json(result.content)
    tests = parsed if isinstance(parsed, list) else []
    return tests, result
