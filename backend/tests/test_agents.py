"""Agent unit tests with a mocked LLM (per Part Q -- all 6 agents + evaluator,
never touching a real network)."""

import json

from app.agents.critic import run_critic
from app.agents.decomposition import run_decomposition
from app.agents.documentation import run_documentation
from app.agents.evaluator import run_evaluator
from app.agents.planner import run_planner
from app.agents.security import run_security
from app.agents.test_generator import run_test_generator
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient

BASE_STATE = {
    "job_id": "test-job",
    "repository_id": "test-repository-id",
    "code_files": [{"file_path": "app.py", "language": "python", "loc": 100}],
    "complexity_metrics": {
        "app.py": {
            "cyclomatic_complexity": 5,
            "coupling_score": 0.2,
            "function_complexities": [
                {"name": "handler", "cyclomatic_complexity": 5, "source": "def handler():\n    pass\n"}
            ],
        }
    },
    "known_file_paths": ["app.py"],
    "known_function_names": ["handler"],
    "primary_language": "python",
}


def _client_and_gateway():
    return AtlasLLMClient(token_budget=50_000), GuardrailGateway(token_budget=50_000)


async def test_planner_parses_valid_json(mock_llm_complete):
    mock_llm_complete(
        json.dumps(
            {
                "domain": "banking",
                "risk_files": ["app.py"],
                "analysis_priorities": ["security"],
                "token_budget": {"documentation": 1000},
                "complexity_summary": "test",
                "recommended_scope": "full",
            }
        )
    )
    llm_client, gateway = _client_and_gateway()
    output, result = await run_planner(BASE_STATE, llm_client, gateway)

    assert output["domain"] == "banking"
    assert result.blocked is False


async def test_planner_falls_back_on_unparseable_output(mock_llm_complete):
    mock_llm_complete("this is not JSON at all")
    llm_client, gateway = _client_and_gateway()
    output, result = await run_planner(BASE_STATE, llm_client, gateway)

    assert output.get("_fallback") is True
    assert "recommended_scope" in output


async def test_decomposition_parses_services(mock_llm_complete):
    mock_llm_complete(
        json.dumps(
            {
                "services": [
                    {
                        "name": "AuthService",
                        "responsibility": "auth",
                        "files": ["app.py"],
                        "api_surface": ["POST /login"],
                        "migration_effort": "Low",
                        "extract_order": 1,
                    }
                ],
                "mermaid_diagram": "graph LR\n  A --> B",
                "recommended_first_extraction": "AuthService",
                "risks": [],
                "estimated_total_effort_weeks": 4,
            }
        )
    )
    llm_client, gateway = _client_and_gateway()
    output, _ = await run_decomposition(BASE_STATE, llm_client, gateway)

    assert output["services"][0]["name"] == "AuthService"


async def test_security_enriches_static_findings_without_inventing_new_ones(mock_llm_complete):
    static_findings = [
        {
            "title": "SQL injection",
            "description": "raw description",
            "severity": "high",
            "file_path": "app.py",
            "line_start": 10,
            "line_end": 10,
            "code_snippet": "SELECT * FROM users WHERE id = " + "{user_id}",
            "owasp_category": "A03",
            "cwe_id": "CWE-89",
            "source": "bandit",
            "rule_id": "B608",
            "confidence": 0.9,
        }
    ]
    state = {**BASE_STATE, "static_findings": static_findings}

    mock_llm_complete(
        json.dumps(
            [
                {
                    "index": 0,
                    "plain_explanation": "User input reaches SQL directly.",
                    "suggested_fix": "Use a parameterized query.",
                    "false_positive_probability": 0.05,
                    "confirmed_owasp_category": "A03",
                    "severity": "critical",
                }
            ]
        )
    )
    llm_client, gateway = _client_and_gateway()
    enriched, _ = await run_security(state, llm_client, gateway)

    assert len(enriched) == 1  # never invents findings beyond what static analysis found
    assert enriched[0]["severity"] == "critical"  # LLM-confirmed severity applied
    assert enriched[0]["file_path"] == "app.py"  # line/file from static analysis, unchanged
    assert enriched[0]["suggested_fix"] == "Use a parameterized query."


async def test_security_returns_empty_when_no_static_findings(mock_llm_complete):
    mock = mock_llm_complete("[]")
    llm_client, gateway = _client_and_gateway()
    enriched, result = await run_security(BASE_STATE, llm_client, gateway)

    assert enriched == []
    assert result is None
    mock.assert_not_called()  # no static findings means no LLM call is made at all


async def test_test_generator_parses_tests(mock_llm_complete):
    mock_llm_complete(
        json.dumps(
            [
                {
                    "source_file": "app.py",
                    "test_file": "test_app.py",
                    "test_code": "def test_handler():\n    assert True\n",
                    "functions_covered": ["handler"],
                    "framework": "pytest",
                }
            ]
        )
    )
    llm_client, gateway = _client_and_gateway()
    tests, _ = await run_test_generator(BASE_STATE, llm_client, gateway)

    assert tests[0]["framework"] == "pytest"


async def test_documentation_returns_markdown(mock_llm_complete):
    mock_llm_complete("# Architecture\n\nThis system does X.")
    llm_client, gateway = _client_and_gateway()
    docs, _ = await run_documentation(BASE_STATE, llm_client, gateway)

    assert "Architecture" in docs


async def test_critic_propagates_reported_corrections(mock_llm_complete):
    """The Critic's own LLM call is what catches hallucinated documentation claims
    (by comparing them against independently-retrieved source) -- this verifies
    that a reported correction actually flows through to the parsed output, since
    that's the plumbing this agent is responsible for, not the guardrail gateway's
    (separate) grounding check on the critique's own output."""
    mock_llm_complete(
        json.dumps(
            {
                "documentation_quality": 0.4,
                "documentation_corrections": [
                    "Docs claim a function `totally_fake_function` in `ghost.py` which does not "
                    "appear anywhere in the retrieved source."
                ],
                "decomposition_quality": 0.9,
                "tests_quality": 0.9,
                "tests_corrections": [],
                "security_quality": 0.9,
                "flagged_findings": [],
                "overall_confidence": 0.6,
                "recommendations": ["Remove the reference to the nonexistent function."],
            }
        )
    )
    state = {**BASE_STATE, "documentation_output": "Docs mentioning totally_fake_function() in ghost.py"}
    llm_client, gateway = _client_and_gateway()
    critique, _ = await run_critic(state, llm_client, gateway)

    assert critique["documentation_quality"] == 0.4
    assert "ghost.py" in critique["documentation_corrections"][0]


async def test_critic_gateway_flags_ungrounded_critique_output(mock_llm_complete):
    """Separately: if the CRITIC's own output cites a file/function that isn't real
    (the critic itself hallucinating), the guardrail gateway's post-call grounding
    check must catch that -- this is what protects against the Critic being wrong too."""
    mock_llm_complete(
        json.dumps(
            {
                "documentation_quality": 0.9,
                "documentation_corrections": [],
                "decomposition_quality": 0.9,
                "tests_quality": 0.9,
                "tests_corrections": [],
                "security_quality": 0.9,
                "flagged_findings": ["nonexistent_finding() in fake_module.py"],
                "overall_confidence": 0.9,
                "recommendations": [],
            }
        )
    )
    llm_client, gateway = _client_and_gateway()
    _, result = await run_critic(BASE_STATE, llm_client, gateway)

    assert result.grounding_confidence < 1.0


async def test_evaluator_parses_scores(mock_llm_complete):
    mock_llm_complete(
        json.dumps(
            {
                "faithfulness": 0.8,
                "completeness": 0.75,
                "actionability": 0.85,
                "test_coverage_estimate": 0.4,
                "decomposition_validity": 0.9,
                "overall_quality_score": 0.82,
                "improvement_suggestions": ["Add more tests"],
            }
        )
    )
    llm_client, gateway = _client_and_gateway()
    evaluation, _ = await run_evaluator(BASE_STATE, llm_client, gateway)

    assert evaluation["overall_quality_score"] == 0.82


async def test_evaluator_falls_back_gracefully_when_blocked(mock_llm_complete):
    from unittest.mock import AsyncMock

    from app.llm.client import AllProvidersExhausted

    llm_client, gateway = _client_and_gateway()
    llm_client.complete = AsyncMock(side_effect=AllProvidersExhausted("all providers down"))

    evaluation, result = await run_evaluator(BASE_STATE, llm_client, gateway)

    assert evaluation.get("_fallback") is True
    assert result.blocked is True
