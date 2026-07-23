"""Shared pytest fixtures: a real (throwaway) Postgres schema per test, an
httpx AsyncClient wired to the FastAPI app, and a mock LLM client so agent
tests never make real network calls.

Requires DATABASE_URL to point at a real Postgres instance (CI provides one
as a service container; locally, point it at a scratch database/branch --
never run this against a production database, since tables are dropped and
recreated for every test).
"""

import os
from dataclasses import dataclass
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://atlas:atlas_dev_password@localhost:5432/atlas_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("GROQ_API_KEY", "")
os.environ.setdefault("MISTRAL_API_KEY", "")

from app import models  # noqa: E402,F401  (registers models on Base.metadata)
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(os.environ["DATABASE_URL"], poolclass=None)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@dataclass
class FakeLLMResponse:
    content: str
    provider: str = "gemini"
    model_id: str = "gemini/gemini-1.5-flash"
    tokens_used: int = 100
    cached: bool = False
    latency_seconds: float = 0.1
    rate_limit_hits: int = 0


@pytest.fixture
def mock_llm_complete(monkeypatch):
    """Patches AtlasLLMClient.complete to return a canned response.

    Usage: mock_llm_complete('{"key": "value"}') then run an agent function --
    it never touches the network.
    """

    def _install(canned_json_text: str):
        from app.llm.client import AtlasLLMClient

        mock = AsyncMock(return_value=FakeLLMResponse(content=canned_json_text))
        monkeypatch.setattr(AtlasLLMClient, "complete", mock)
        return mock

    return _install
