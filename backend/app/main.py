import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.logging_config import configure_logging
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.observability.tracing import configure_tracing
from app.rate_limit import limiter
from app.routers import analytics, auth, demo, findings, jobs, projects, reports, repositories, results

configure_logging()
logger = logging.getLogger("atlas")

settings = get_settings()

app = FastAPI(title="Atlas", version="1.0.0", description="Agentic AI Legacy Modernization Platform")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger.info("Configured CORS origins: %s", settings.cors_origins_list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

configure_tracing(app)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(repositories.router)
app.include_router(jobs.router)
app.include_router(results.router)
app.include_router(findings.router)
app.include_router(reports.router)
app.include_router(demo.router)
app.include_router(analytics.router)

if settings.prometheus_metrics_enabled:
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        Instrumentator().instrument(app).expose(app, endpoint="/metrics")
    except ImportError:
        logger.warning("prometheus-fastapi-instrumentator not installed; /metrics disabled")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    # cors_origins is included here (not just logged) so a live deploy's actual
    # config is a single curl away instead of a trip through the host's log viewer --
    # this is exactly the field that made a real CORS_ORIGINS mismatch hard to
    # diagnose remotely. Not sensitive: these are public frontend origins, not secrets.
    return {"status": "ok", "version": app.version, "cors_origins": settings.cors_origins_list}


@app.get("/health/ready")
async def health_ready():
    checks = {"database": False, "redis": False}

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        logger.exception("Database readiness check failed")

    try:
        redis_client = Redis.from_url(settings.redis_url)
        await redis_client.ping()
        await redis_client.aclose()
        checks["redis"] = True
    except Exception:
        logger.exception("Redis readiness check failed")

    all_ready = all(checks.values())
    status_code = 200 if all_ready else 503
    return JSONResponse(status_code=status_code, content={"ready": all_ready, "checks": checks})
