"""Detects prompt-injection attempts in code/content headed into an LLM prompt.

Legacy source code is untrusted input from Atlas's perspective -- a comment
or string literal could contain "ignore previous instructions" style text
aimed at hijacking the agent. Regex + keyword heuristics catch the common
patterns; this is deliberately cheap (no LLM call) since it runs on every
single prompt.
"""

import re
from dataclasses import dataclass

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|above)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(a|an)\s+\w+", re.IGNORECASE),
    re.compile(r"\bDAN\s+mode\b", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
    re.compile(r"system\s*:\s*you\s+must", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?(system\s+prompt|instructions)", re.IGNORECASE),
    re.compile(r"act\s+as\s+if\s+you\s+(have\s+no|are\s+not)\s+restrictions", re.IGNORECASE),
    re.compile(r"<\|im_start\|>|<\|im_end\|>", re.IGNORECASE),
]


@dataclass
class InjectionScanResult:
    detected: bool
    matched_patterns: list[str]
    confidence: float


def scan_for_injection(text: str) -> InjectionScanResult:
    matches = [p.pattern for p in INJECTION_PATTERNS if p.search(text)]
    confidence = min(1.0, 0.4 + 0.2 * len(matches)) if matches else 0.0
    return InjectionScanResult(detected=bool(matches), matched_patterns=matches, confidence=confidence)
