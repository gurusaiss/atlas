from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()


# libpq-style query params that managed Postgres providers (Neon, Supabase, etc.)
# append to connection strings but that asyncpg's connect() does not accept.
_LIBPQ_ONLY_PARAMS = ("sslmode", "channel_binding")


def _build_engine_kwargs(raw_url: str) -> dict:
    """Strip libpq-only params from URL query string and convert sslmode to connect_args ssl."""
    parsed = urlparse(raw_url)
    params = parse_qs(parsed.query, keep_blank_values=True)
    sslmode = params.pop("sslmode", [None])[0]
    for key in _LIBPQ_ONLY_PARAMS:
        params.pop(key, None)

    new_query = urlencode({k: v[0] for k, v in params.items()})
    clean_url = urlunparse(parsed._replace(query=new_query))

    connect_args: dict = {}
    if sslmode and sslmode not in ("disable", "allow", "prefer"):
        connect_args["ssl"] = True

    return {"url": clean_url, "connect_args": connect_args}


_engine_kwargs = _build_engine_kwargs(settings.database_url)
engine = create_async_engine(**_engine_kwargs, pool_pre_ping=True, echo=False)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
