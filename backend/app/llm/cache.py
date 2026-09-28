"""Redis-backed LLM response cache, keyed on (model, system_prompt, user_prompt).

This is the single highest-leverage rate-limit mitigation in Atlas: repeated
demo runs, retried agents, and repeated interview live-demos all hit the same
cache key and cost zero additional tokens.
"""

import hashlib
import json
import logging

from redis.asyncio import Redis

from app.config import get_settings, redis_ssl_kwargs

logger = logging.getLogger("atlas.llm_cache")
settings = get_settings()

CACHE_TTL_SECONDS = 86_400  # 24 hours, per Constraint 5
_redis_client: Redis | None = None


def _get_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(
            settings.redis_url, decode_responses=True, **redis_ssl_kwargs(settings.redis_url)
        )
    return _redis_client


def cache_key(model: str, system_prompt: str, user_prompt: str) -> str:
    digest = hashlib.sha256(f"{model}\n{system_prompt}\n{user_prompt}".encode("utf-8")).hexdigest()
    return f"atlas:llm_cache:{digest}"


async def get_cached_response(model: str, system_prompt: str, user_prompt: str) -> dict | None:
    key = cache_key(model, system_prompt, user_prompt)
    try:
        raw = await _get_client().get(key)
    except Exception as exc:
        logger.warning("LLM cache read failed (continuing without cache): %s", exc)
        return None
    return json.loads(raw) if raw else None


async def set_cached_response(model: str, system_prompt: str, user_prompt: str, response: dict) -> None:
    key = cache_key(model, system_prompt, user_prompt)
    try:
        await _get_client().set(key, json.dumps(response), ex=CACHE_TTL_SECONDS)
    except Exception as exc:
        logger.warning("LLM cache write failed (continuing without cache): %s", exc)
