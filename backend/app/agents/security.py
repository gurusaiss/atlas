"""Security Agent -- static-analysis-first, LLM-enrichment-second.

Semgrep (OWASP ruleset) and Bandit run first and find exact line numbers
deterministically -- LLMs hallucinate line numbers, static analyzers don't.
The LLM is used ONLY to explain each finding in plain English, suggest a
concrete fix, assess false-positive probability, and confirm the OWASP
category. This mirrors how GitHub Advanced Security combines CodeQL + AI.
"""

import logging

from app.agents.base import GuardedLLMResult, extract_json, guarded_complete
from app.agents.state import AtlasState
from app.guardrails.gateway import GuardrailGateway
from app.llm.client import AtlasLLMClient

logger = logging.getLogger("atlas.agents.security")

OWASP_TITLES = {
    "A01": "Broken Access Control",
    "A02": "Cryptographic Failures",
    "A03": "Injection",
    "A04": "Insecure Design",
    "A05": "Security Misconfiguration",
    "A06": "Vulnerable and Outdated Components",
    "A07": "Identification and Authentication Failures",
    "A08": "Software and Data Integrity Failures",
    "A09": "Security Logging and Monitoring Failures",
    "A10": "Server-Side Request Forgery (SSRF)",
}

SYSTEM_PROMPT = """You are the Security Agent in a legacy-modernization pipeline.
You are given REAL vulnerability findings located by static analysis tools
(Semgrep and Bandit) with exact line numbers. Do NOT invent new findings or
change line numbers. For each finding, explain it plainly, suggest a concrete
code fix, and assess the probability it is a false positive.
Output ONLY a JSON array."""

USER_PROMPT_TEMPLATE = """Enrich these static-analysis security findings.

{findings_block}

Return a JSON array where each element corresponds to one input finding (same order):
[
  {{
    "index": <int, matching the input finding number>,
    "plain_explanation": "<what the vulnerability means for a non-security audience>",
    "suggested_fix": "<concrete code-level fix>",
    "false_positive_probability": <float 0.0-1.0>,
    "confirmed_owasp_category": "<A01..A10>",
    "severity": "<critical|high|medium|low|info>"
  }}
]"""


def _findings_block(static_findings: list[dict]) -> str:
    blocks = []
    for i, f in enumerate(static_findings):
        blocks.append(
            f"Finding #{i}:\n"
            f"  Tool: {f.get('source')} (rule {f.get('rule_id')})\n"
            f"  File: {f.get('file_path')} lines {f.get('line_start')}-{f.get('line_end')}\n"
            f"  Reported severity: {f.get('severity')}\n"
            f"  OWASP (tool guess): {f.get('owasp_category')}\n"
            f"  Description: {f.get('description', '')[:300]}\n"
            f"  Code:\n{(f.get('code_snippet') or '')[:400]}"
        )
    return "\n\n".join(blocks)


async def run_security(
    state: AtlasState, llm_client: AtlasLLMClient, gateway: GuardrailGateway
) -> tuple[list[dict], GuardedLLMResult | None]:
    static_findings = state.get("static_findings", [])

    if not static_findings:
        logger.info("No static findings to enrich")
        return [], None

    user_prompt = USER_PROMPT_TEMPLATE.format(findings_block=_findings_block(static_findings))

    result = await guarded_complete(
        llm_client=llm_client,
        gateway=gateway,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
        agent_type="security",
        known_file_paths=set(state.get("known_file_paths", [])),
        known_function_names=set(state.get("known_function_names", [])),
        max_tokens=3000,
        job_id=state.get("job_id"),
    )

    enrichments = extract_json(result.content) if not result.blocked else None
    enrichment_map = {}
    if isinstance(enrichments, list):
        for e in enrichments:
            if isinstance(e, dict) and "index" in e:
                enrichment_map[e["index"]] = e

    enriched = []
    for i, finding in enumerate(static_findings):
        e = enrichment_map.get(i, {})
        owasp = e.get("confirmed_owasp_category") or finding.get("owasp_category")
        enriched.append(
            {
                **finding,
                "title": finding.get("title"),
                "description": e.get("plain_explanation") or finding.get("description"),
                "suggested_fix": e.get("suggested_fix"),
                "severity": e.get("severity") or finding.get("severity"),
                "owasp_category": owasp,
                "owasp_title": OWASP_TITLES.get(owasp) if owasp else None,
                "confidence": round(1.0 - float(e.get("false_positive_probability", 0.0)), 4)
                if e
                else finding.get("confidence", 0.75),
                "finding_type": "security",
                "category": f"owasp_{owasp.lower()}" if owasp else "security",
            }
        )

    return enriched, result
