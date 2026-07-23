"""The Responsible-AI Guardrail Gateway: every LLM call in Atlas goes through this.

Implements Scan-Shield-Steer:
  Scan  -- pre-call: prompt-injection + PII detection on the outbound prompt, budget check.
  Shield -- the actual LLM call happens only if Scan allows it.
  Steer -- post-call: grounding check + PII scan on the response before it's stored/shown.

Every check emits a GuardrailEvent (persisted by the caller) so the dashboard
can show a live "PII blocked" / "prompt injection flagged" feed during a job.
"""

import json
import re
from dataclasses import dataclass, field

from app.guardrails.budget import check_budget
from app.guardrails.hallucination import check_grounding
from app.guardrails.pii_detector import scan_and_redact
from app.guardrails.prompt_injection import scan_for_injection

INJECTION_BLOCK_THRESHOLD = 0.6

_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", re.DOTALL)


def _contains_parseable_json(text: str) -> bool:
    """Loosely mirrors agents/base.py's extract_json tolerance (raw, fenced, or the
    first balanced {...}/[...] span) without importing agents.base, which would
    create a circular import (agents.base -> guardrails.gateway -> agents.base)."""
    fenced = _FENCED_JSON_RE.search(text)
    candidate = fenced.group(1) if fenced else text

    try:
        json.loads(candidate)
        return True
    except (json.JSONDecodeError, ValueError):
        pass

    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        start, end = candidate.find(open_ch), candidate.rfind(close_ch)
        if start != -1 and end > start:
            try:
                json.loads(candidate[start : end + 1])
                return True
            except (json.JSONDecodeError, ValueError):
                continue
    return False


@dataclass
class GuardrailEventRecord:
    check_type: str
    action_taken: str  # allowed | blocked | redacted | flagged | warned
    confidence: float | None
    original_length: int | None
    processed_length: int | None
    details: dict = field(default_factory=dict)


@dataclass
class PreCallResult:
    allowed: bool
    sanitized_prompt: str
    events: list[GuardrailEventRecord]
    block_reason: str | None = None


@dataclass
class PostCallResult:
    sanitized_output: str
    events: list[GuardrailEventRecord]
    grounding_confidence: float


class GuardrailGateway:
    """Scan-Shield-Steer wrapper. Instantiate once per job so budget state accumulates."""

    def __init__(self, token_budget: int):
        self.token_budget = token_budget
        self.tokens_spent = 0

    def pre_call(self, prompt: str, estimated_tokens: int) -> PreCallResult:
        events: list[GuardrailEventRecord] = []

        injection = scan_for_injection(prompt)
        if injection.detected and injection.confidence >= INJECTION_BLOCK_THRESHOLD:
            events.append(
                GuardrailEventRecord(
                    check_type="prompt_injection",
                    action_taken="blocked",
                    confidence=injection.confidence,
                    original_length=len(prompt),
                    processed_length=None,
                    details={"matched_patterns": injection.matched_patterns},
                )
            )
            return PreCallResult(
                allowed=False, sanitized_prompt=prompt, events=events, block_reason="prompt_injection_detected"
            )
        if injection.detected:
            events.append(
                GuardrailEventRecord(
                    check_type="prompt_injection",
                    action_taken="flagged",
                    confidence=injection.confidence,
                    original_length=len(prompt),
                    processed_length=len(prompt),
                    details={"matched_patterns": injection.matched_patterns},
                )
            )

        pii = scan_and_redact(prompt)
        sanitized_prompt = pii.redacted_text
        if pii.has_pii:
            events.append(
                GuardrailEventRecord(
                    check_type="pii_input",
                    action_taken="redacted",
                    confidence=1.0,
                    original_length=pii.original_length,
                    processed_length=pii.processed_length,
                    details={"entity_types": pii.entity_types},
                )
            )

        budget_result = check_budget(self.tokens_spent, self.token_budget, estimated_tokens)
        if not budget_result.allowed:
            events.append(
                GuardrailEventRecord(
                    check_type="budget_exceeded",
                    action_taken="blocked",
                    confidence=1.0,
                    original_length=None,
                    processed_length=None,
                    details={
                        "tokens_spent": budget_result.tokens_spent,
                        "budget": budget_result.budget,
                        "estimated_next_call_tokens": estimated_tokens,
                    },
                )
            )
            return PreCallResult(
                allowed=False, sanitized_prompt=sanitized_prompt, events=events, block_reason="budget_exceeded"
            )

        return PreCallResult(allowed=True, sanitized_prompt=sanitized_prompt, events=events)

    def record_tokens_spent(self, tokens: int) -> None:
        self.tokens_spent += tokens

    def post_call(
        self, llm_output: str, known_file_paths: set[str], known_function_names: set[str]
    ) -> PostCallResult:
        events: list[GuardrailEventRecord] = []

        grounding = check_grounding(llm_output, known_file_paths, known_function_names)
        if not grounding.grounded:
            events.append(
                GuardrailEventRecord(
                    check_type="hallucination",
                    action_taken="flagged",
                    confidence=grounding.confidence,
                    original_length=len(llm_output),
                    processed_length=len(llm_output),
                    details={
                        "ungrounded_file_paths": grounding.ungrounded_file_paths,
                        "ungrounded_function_names": grounding.ungrounded_function_names,
                    },
                )
            )

        pii = scan_and_redact(llm_output)
        sanitized_output = pii.redacted_text

        if pii.has_pii and _contains_parseable_json(llm_output) and not _contains_parseable_json(sanitized_output):
            # Redaction broke JSON the calling agent needs to parse (e.g. Presidio's
            # URL recognizer false-positiving on a filename like "app.py"). Preserving
            # a low-risk substring is better than corrupting the agent's entire
            # structured output -- keep the original and just flag it for visibility.
            sanitized_output = llm_output
            events.append(
                GuardrailEventRecord(
                    check_type="pii_output",
                    action_taken="flagged",
                    confidence=1.0,
                    original_length=pii.original_length,
                    processed_length=pii.original_length,
                    details={"entity_types": pii.entity_types, "reason": "redaction_would_break_json"},
                )
            )
        elif pii.has_pii:
            events.append(
                GuardrailEventRecord(
                    check_type="pii_output",
                    action_taken="redacted",
                    confidence=1.0,
                    original_length=pii.original_length,
                    processed_length=pii.processed_length,
                    details={"entity_types": pii.entity_types},
                )
            )

        return PostCallResult(
            sanitized_output=sanitized_output, events=events, grounding_confidence=grounding.confidence
        )
