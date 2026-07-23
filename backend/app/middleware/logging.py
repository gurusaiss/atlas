"""Structured JSON request/response logging middleware, per Part J.

Every request logs {timestamp, level, service, method, path, status_code,
duration_ms, user_id (if authenticated)} as a single JSON line -- easy to
ship to any log aggregator (Grafana Loki, ELK, CloudWatch) without a custom
parser.
"""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("atlas.requests")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        request_id = str(uuid.uuid4())

        response = await call_next(request)

        duration_ms = round((time.monotonic() - start) * 1000, 2)
        logger.info(
            "request_handled",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": request.client.host if request.client else None,
            },
        )
        response.headers["X-Request-ID"] = request_id
        return response
