"""Per-provider exponential backoff and rate-limit-hit tracking.

Providers publish free-tier RPM limits; when a call 429s, we back off
(2^n seconds, capped at 32s) and after MAX_RETRIES_PER_PROVIDER consecutive
429s hand off to the next provider in the fallback chain instead of failing
the whole job.
"""

import asyncio
import logging

logger = logging.getLogger("atlas.rate_limiter")

MAX_RETRIES_PER_PROVIDER = 3
BASE_BACKOFF_SECONDS = 2
MAX_BACKOFF_SECONDS = 32


class RateLimitExceeded(Exception):
    """Raised when a single provider has been retried past MAX_RETRIES_PER_PROVIDER."""


async def backoff_sleep(attempt: int) -> None:
    delay = min(BASE_BACKOFF_SECONDS**attempt, MAX_BACKOFF_SECONDS)
    logger.info("Rate limited; backing off %ds (attempt %d)", delay, attempt)
    await asyncio.sleep(delay)


def is_rate_limit_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None) or getattr(exc, "http_status", None)
    if status_code == 429:
        return True
    message = str(exc).lower()
    return "rate limit" in message or "quota" in message or "429" in message
