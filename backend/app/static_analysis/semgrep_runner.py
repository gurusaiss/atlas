"""Runs Semgrep with the OWASP Top 10 ruleset and normalizes findings.

Semgrep covers Java/JS/etc. that Bandit (Python-only) doesn't, and its
`p/owasp-top-ten` registry ruleset ships pre-mapped CWE/OWASP metadata --
zero tokens spent before the Security Agent's LLM enrichment step.
"""

import json
import logging
import subprocess

from app.static_analysis.bandit_runner import StaticFinding

logger = logging.getLogger("atlas.semgrep")

SEMGREP_SEVERITY_MAP = {"ERROR": "high", "WARNING": "medium", "INFO": "low"}
SEMGREP_RULESET = "p/owasp-top-ten"


def _extract_owasp_category(metadata: dict) -> str | None:
    owasp_list = metadata.get("owasp", [])
    if isinstance(owasp_list, str):
        owasp_list = [owasp_list]
    for entry in owasp_list:
        # Semgrep formats this as e.g. "A03:2021 - Injection"
        code = entry.split(":")[0].strip()
        if code.startswith("A"):
            return code
    return None


def _extract_cwe(metadata: dict) -> str | None:
    cwe_list = metadata.get("cwe", [])
    if isinstance(cwe_list, str):
        cwe_list = [cwe_list]
    if cwe_list:
        first = cwe_list[0]
        return first.split(":")[0].strip() if ":" in first else first
    return None


def run_semgrep(target_dir: str, ruleset: str = SEMGREP_RULESET) -> list[StaticFinding]:
    try:
        proc = subprocess.run(
            ["semgrep", "scan", "--config", ruleset, "--json", "--quiet", target_dir],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except FileNotFoundError:
        logger.error("semgrep executable not found on PATH")
        return []
    except subprocess.TimeoutExpired:
        logger.error("semgrep timed out scanning %s", target_dir)
        return []

    if not proc.stdout.strip():
        return []

    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        logger.error("Failed to parse semgrep output: %s", proc.stderr[:500])
        return []

    findings = []
    for result in payload.get("results", []):
        metadata = result.get("extra", {}).get("metadata", {})
        severity = SEMGREP_SEVERITY_MAP.get(result.get("extra", {}).get("severity", "WARNING"), "medium")

        findings.append(
            StaticFinding(
                title=result.get("extra", {}).get("message", result.get("check_id", "")).split("\n")[0][:200],
                description=result.get("extra", {}).get("message", ""),
                severity=severity,
                file_path=result.get("path", ""),
                line_start=result.get("start", {}).get("line", 0),
                line_end=result.get("end", {}).get("line", 0),
                code_snippet=result.get("extra", {}).get("lines", ""),
                owasp_category=_extract_owasp_category(metadata),
                cwe_id=_extract_cwe(metadata),
                source="semgrep",
                rule_id=result.get("check_id", ""),
                confidence=0.85,
            )
        )

    return findings
