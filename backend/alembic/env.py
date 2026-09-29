import asyncio
import sys
import time
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.config import get_settings
from app.database import Base, _build_engine_kwargs
from app import models  # noqa: F401  -- registers all models on Base.metadata

config = context.config
settings = get_settings()
# Use the cleaned URL (sslmode stripped; asyncpg does not accept it as a URL param)
_db_kwargs = _build_engine_kwargs(settings.database_url)
config.set_main_option("sqlalchemy.url", _db_kwargs["url"])

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


# Managed Postgres providers (e.g. Neon free tier) suspend their compute after
# inactivity and cold-start on the next connection, which can take longer than
# asyncpg's default (unbounded) connect wait. Fail fast and retry with visible
# logging instead of hanging silently past Render's port-scan deploy budget.
_CONNECT_TIMEOUT_SECONDS = 15
_MAX_ATTEMPTS = 5


async def run_migrations_online() -> None:
    connect_args = {**_db_kwargs.get("connect_args", {}), "timeout": _CONNECT_TIMEOUT_SECONDS}
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            print(f"Connecting to database (attempt {attempt}/{_MAX_ATTEMPTS})...", flush=True)
            async with connectable.connect() as connection:
                await connection.run_sync(do_run_migrations)
            break
        except Exception as exc:
            print(f"  connection attempt {attempt} failed: {exc!r}", flush=True)
            if attempt == _MAX_ATTEMPTS:
                print("Giving up after max attempts.", flush=True)
                sys.exit(1)
            time.sleep(min(2**attempt, 20))

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
