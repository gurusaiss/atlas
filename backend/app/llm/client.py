"""Unified multi-LLM gateway: cache -> guardrails -> provider fallback chain.

Every agent calls `AtlasLLMClient.complete()` -- never a provider SDK
directly -- so caching, budget enforcement, and fallback are guaranteed
uniform across the whole pipeline.
"""

import logging
import time
from dataclasses import dataclass

import litellm

from app.config import get_settings
from app.llm.cache import get_cached_response, set_cached_response
from app.llm.rate_limiter import MAX_RETRIES_PER_PROVIDER, backoff_sleep, is_rate_limit_error
from app.llm.router import get_litellm_model_id, get_provider_chain

logger = logging.getLogger("atlas.llm_client")
settings = get_settings()

litellm.suppress_debug_info = True


@dataclass
class LLMResponse:
    content: str
    provider: str
    model_id: str
    tokens_used: int
    cached: bool
    latency_seconds: float
    rate_limit_hits: int


class TokenBudgetExceeded(Exception):
    pass


class AllProvidersExhausted(Exception):
    pass


def _provider_api_key(provider: str) -> str | None:
    return {
        "gemini": settings.gemini_api_key,
        "groq": settings.groq_api_key,
        "mistral": settings.mistral_api_key,
        "ollama": None,  # local, no key required
    }.get(provider)


class AtlasLLMClient:
    def __init__(self, token_budget: int | None = None):
        self.token_budget = token_budget or settings.default_token_budget
        self.tokens_spent = 0

    def _check_budget(self, estimated_tokens: int) -> None:
        if self.tokens_spent + estimated_tokens > self.token_budget:
            raise TokenBudgetExceeded(
                f"Token budget of {self.token_budget} would be exceeded "
                f"(already spent {self.tokens_spent}, need ~{estimated_tokens} more)"
            )

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        agent_type: str,
        max_tokens: int = 2000,
        job_id: str | None = None,
    ) -> LLMResponse:
        provider_chain = get_provider_chain(agent_type)
        rate_limit_hits = 0

        # Cache is keyed on the *first preferred* model so identical prompts for the
        # same agent always hit the same cache entry regardless of later fallback.
        primary_model_id = get_litellm_model_id(provider_chain[0])
        cached = await get_cached_response(primary_model_id, system_prompt, user_prompt)
        if cached is not None:
            return LLMResponse(
                content=cached["content"],
                provider=cached["provider"],
                model_id=cached["model_id"],
                tokens_used=cached["tokens_used"],
                cached=True,
                latency_seconds=0.0,
                rate_limit_hits=0,
            )

        self._check_budget(max_tokens)

        last_error: Exception | None = None
        for provider in provider_chain:
            if provider != "ollama" and not _provider_api_key(provider):
                continue  # skip providers with no configured API key

            model_id = get_litellm_model_id(provider)
            api_key = _provider_api_key(provider)

            for attempt in range(MAX_RETRIES_PER_PROVIDER):
                start = time.monotonic()
                try:
                    response = await litellm.acompletion(
                        model=model_id,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        max_tokens=max_tokens,
                        api_key=api_key,
                        api_base=settings.ollama_base_url if provider == "ollama" else None,
                        timeout=20,  # bounds a single attempt; never let one slow provider hang a job
                    )
                    latency = time.monotonic() - start
                    content = response.choices[0].message.content
                    tokens_used = response.usage.total_tokens if response.usage else max_tokens

                    result = LLMResponse(
                        content=content,
                        provider=provider,
                        model_id=model_id,
                        tokens_used=tokens_used,
                        cached=False,
                        latency_seconds=latency,
                        rate_limit_hits=rate_limit_hits,
                    )
                    self.tokens_spent += tokens_used

                    await set_cached_response(
                        primary_model_id,
                        system_prompt,
                        user_prompt,
                        {
                            "content": content,
                            "provider": provider,
                            "model_id": model_id,
                            "tokens_used": tokens_used,
                        },
                    )
                    return result

                except Exception as exc:
                    last_error = exc
                    if is_rate_limit_error(exc):
                        rate_limit_hits += 1
                        logger.warning(
                            "Rate limited on provider=%s attempt=%d job=%s", provider, attempt, job_id
                        )
                        if attempt < MAX_RETRIES_PER_PROVIDER - 1:
                            await backoff_sleep(attempt)
                        continue
                    logger.error("Provider %s failed (non-rate-limit): %s", provider, exc)
                    break  # non-rate-limit error: move straight to next provider

        raise AllProvidersExhausted(
            f"All LLM providers exhausted for agent_type={agent_type}. Last error: {last_error}"
        )
