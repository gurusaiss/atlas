"""Security response headers, per Part I (OWASP A05 - Security Misconfiguration)."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# FastAPI's built-in /docs (Swagger UI) and /redoc load their JS/CSS from a CDN
# (cdn.jsdelivr.net), not from this origin. A blanket `default-src 'self'` CSP
# silently blocks those assets -- the pages load but render blank, no console
# error obvious to a casual visitor. Everything else (actual API responses,
# which are JSON, not HTML) has no legitimate use for a relaxed CSP, so only
# these three documentation paths get the CDN allowance.
DOCS_PATHS = {"/docs", "/redoc", "/openapi.json"}
DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
    "img-src 'self' data: fastapi.tiangolo.com; "
    "font-src 'self' data:; "
    "worker-src 'self' blob:; "
    "connect-src 'self'"
)
DEFAULT_CSP = "default-src 'self'"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            DOCS_CSP if request.url.path in DOCS_PATHS else DEFAULT_CSP
        )
        return response
