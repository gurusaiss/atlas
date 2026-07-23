import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.finding import Finding
    from app.models.project import Project
    from app.models.repository import Repository


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id"), index=True
    )
    job_type: Mapped[str] = mapped_column(String(100), default="full_analysis")
    status: Mapped[str] = mapped_column(String(50), default="queued", index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    current_agent: Mapped[str | None] = mapped_column(String(100), nullable=True)
    current_step: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    gemini_tokens: Mapped[int] = mapped_column(Integer, default=0)
    groq_tokens: Mapped[int] = mapped_column(Integer, default=0)
    mistral_tokens: Mapped[int] = mapped_column(Integer, default=0)
    rate_limit_hits: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="jobs")
    repository: Mapped["Repository"] = relationship(back_populates="jobs")
    agent_results: Mapped[list["AgentResult"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class AgentResult(Base):
    __tablename__ = "agent_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    output_markdown: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    execution_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped["Job"] = relationship(back_populates="agent_results")
    findings: Mapped[list["Finding"]] = relationship(
        back_populates="agent_result", cascade="all, delete-orphan"
    )
