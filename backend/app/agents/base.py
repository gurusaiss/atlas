"""Shared agent plumbing: the guarded LLM call every agent uses.

Guarantees that no agent can bypass the Guardrail Gateway or the multi-LLM
client -- the two invariants the interview talking points depend on.
"""

import json
import logging
import re
from dataclasses import dataclass

from app.guardrails.gateway import GuardrailEventRecord, GuardrailGateway
from app.llm.client import AllProvidersExhausted, AtlasLLMClient, TokenBudgetExceeded

logger = logging.getLogger("atlas.agents")


@dataclass
class GuardedLLMResult:
    content: str
    provider: str
    model_id: str
    tokens_used: int
    cached: bool
    grounding_confidence: float
    rate_limit_hits: int
    guardrail_events: list[GuardrailEventRecord]
    blocked: bool = False
    block_reason: str | None = None


async def guarded_complete(
    llm_client: AtlasLLMClient,
    gateway: GuardrailGateway,
    system_prompt: str,
    user_prompt: str,
    agent_type: str,
    known_file_paths: set[str],
    known_function_names: set[str],
    max_tokens: int = 2000,
    job_id: str | None = None,
) -> GuardedLLMResult:
    """Scan -> Shield (LLM call) -> Steer, returning content + all guardrail events."""
    estimated_tokens = max_tokens + len(user_prompt) // 4
    pre = gateway.pre_call(user_prompt, estimated_tokens)
    events = list(pre.events)

    if not pre.allowed:
        return GuardedLLMResult(
            content="",
            provider="none",
            model_id="none",
            tokens_used=0,
            cached=False,
            grounding_confidence=0.0,
            rate_limit_hits=0,
            guardrail_events=events,
            blocked=True,
            block_reason=pre.block_reason,
        )

    try:
        response = await llm_client.complete(
            system_prompt=system_prompt,
            user_prompt=pre.sanitized_prompt,
            agent_type=agent_type,
            max_tokens=max_tokens,
            job_id=job_id,
        )
    except (AllProvidersExhausted, TokenBudgetExceeded) as exc:
        # Every provider failed (no keys configured, outage, or budget exhausted) --
        # degrade to each agent's fallback output instead of crashing the whole job.
        logger.error("LLM call failed for agent_type=%s: %s", agent_type, exc)
        return GuardedLLMResult(
            content="",
            provider="none",
            model_id="none",
            tokens_used=0,
            cached=False,
            grounding_confidence=0.0,
            rate_limit_hits=0,
            guardrail_events=events,
            blocked=True,
            block_reason=str(exc),
        )

    gateway.record_tokens_spent(response.tokens_used)

    post = gateway.post_call(response.content, known_file_paths, known_function_names)
    events.extend(post.events)

    return GuardedLLMResult(
        content=post.sanitized_output,
        provider=response.provider,
        model_id=response.model_id,
        tokens_used=response.tokens_used,
        cached=response.cached,
        grounding_confidence=post.grounding_confidence,
        rate_limit_hits=response.rate_limit_hits,
        guardrail_events=events,
    )


def extract_json(text: str) -> dict | list | None:
    """Best-effort JSON extraction from an LLM response (handles ```json fences and prose)."""
    fenced = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    candidate = fenced.group(1) if fenced else text

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Fall back to the first balanced {...} or [...] block.
    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        start = candidate.find(open_ch)
        end = candidate.rfind(close_ch)
        if start != -1 and end > start:
            try:
                return json.loads(candidate[start : end + 1])
            except json.JSONDecodeError:
                continue
    logger.warning("Could not extract JSON from LLM response")
    return None
