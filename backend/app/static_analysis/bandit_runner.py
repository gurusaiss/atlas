"""Runs Bandit (Python security linter) and normalizes findings to Atlas's shape.

Deterministic, zero-token: Bandit finds exact line numbers for real
vulnerability patterns before any LLM is involved. The Security Agent later
uses an LLM only to explain/enrich these findings, not to locate them --
LLMs hallucinate line numbers, static analyzers don't.
"""

import json
import logging
import subprocess
from dataclasses import dataclass

logger = logging.getLogger("atlas.bandit")

BANDIT_SEVERITY_MAP = {"LOW": "low", "MEDIUM": "medium", "HIGH": "high"}

# Bandit test IDs mapped to the OWASP Top 10 (2021) category they most closely match.
BANDIT_OWASP_MAP = {
    "B101": "A04",  # assert used
    "B102": "A03",  # exec used
    "B103": "A05",  # bad file permissions
    "B104": "A05",  # hardcoded bind to all interfaces
    "B404": "A03",  # subprocess module import (injection surface)
    "B105": "A02",  # hardcoded password string
    "B106": "A02",  # hardcoded password funcarg
    "B107": "A02",  # hardcoded password default
    "B108": "A05",  # hardcoded tmp directory
    "B110": "A09",  # try/except/pass
    "B201": "A05",  # flask debug true
    "B301": "A08",  # pickle
    "B303": "A02",  # insecure MD5/SHA1 hash
    "B304": "A02",  # insecure cipher
    "B305": "A02",  # insecure cipher mode
    "B306": "A03",  # mktemp
    "B307": "A03",  # eval
    "B310": "A10",  # urllib urlopen
    "B311": "A02",  # standard pseudo-random generator
    "B324": "A02",  # weak hash function
    "B501": "A02",  # request without cert verification
    "B502": "A02",  # ssl with bad version
    "B506": "A03",  # yaml load
    "B601": "A03",  # shell injection via paramiko
    "B602": "A03",  # subprocess with shell=True
    "B603": "A03",  # subprocess without shell equals true
    "B604": "A03",  # any function with shell=True
    "B605": "A03",  # start process with a shell
    "B608": "A03",  # SQL injection via string building
    "B609": "A03",  # wildcard injection
}


@dataclass
class StaticFinding:
    title: str
    description: str
    severity: str
    file_path: str
    line_start: int
    line_end: int
    code_snippet: str
    owasp_category: str | None
    cwe_id: str | None
    source: str
    rule_id: str
    confidence: float


def run_bandit(target_dir: str) -> list[StaticFinding]:
    try:
        proc = subprocess.run(
            ["bandit", "-r", target_dir, "-f", "json", "-q"],
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError:
        logger.error("bandit executable not found on PATH")
        return []
    except subprocess.TimeoutExpired:
        logger.error("bandit timed out scanning %s", target_dir)
        return []

    if not proc.stdout.strip():
        return []

    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        logger.error("Failed to parse bandit output: %s", proc.stderr[:500])
        return []

    findings = []
    for result in payload.get("results", []):
        test_id = result.get("test_id", "")
        confidence_label = result.get("issue_confidence", "MEDIUM")
        confidence = {"LOW": 0.5, "MEDIUM": 0.75, "HIGH": 0.95}.get(confidence_label, 0.75)

        findings.append(
            StaticFinding(
                title=result.get("issue_text", test_id),
                description=f"{result.get('issue_text', '')} (Bandit {test_id})",
                severity=BANDIT_SEVERITY_MAP.get(result.get("issue_severity", "MEDIUM"), "medium"),
                file_path=result.get("filename", ""),
                line_start=result.get("line_number", 0),
                line_end=result.get("line_range", [result.get("line_number", 0)])[-1],
                code_snippet=result.get("code", ""),
                owasp_category=BANDIT_OWASP_MAP.get(test_id),
                cwe_id=f"CWE-{result['issue_cwe']['id']}" if result.get("issue_cwe") else None,
                source="bandit",
                rule_id=test_id,
                confidence=confidence,
            )
        )

    return findings
