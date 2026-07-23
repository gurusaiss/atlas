import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.project import Project


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    upload_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    primary_language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    total_loc: Mapped[int] = mapped_column(Integer, default=0)
    commit_sha: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="repositories")
    code_files: Mapped[list["CodeFile"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    call_graph_edges: Mapped[list["CallGraphEdge"]] = relationship(
        back_populates="repository", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(back_populates="repository", cascade="all, delete-orphan")


class CodeFile(Base):
    __tablename__ = "code_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    loc: Mapped[int] = mapped_column(Integer, default=0)
    cyclomatic_complexity: Mapped[float] = mapped_column(Float, default=0)
    cognitive_complexity: Mapped[float] = mapped_column(Float, default=0)
    coupling_score: Mapped[float] = mapped_column(Float, default=0)
    cohesion_score: Mapped[float] = mapped_column(Float, default=0)
    technical_debt_minutes: Mapped[float] = mapped_column(Float, default=0)
    is_entry_point: Mapped[bool] = mapped_column(Boolean, default=False)
    function_count: Mapped[int] = mapped_column(Integer, default=0)
    class_count: Mapped[int] = mapped_column(Integer, default=0)
    parsed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    repository: Mapped["Repository"] = relationship(back_populates="code_files")
    chunks: Mapped[list["CodeChunk"]] = relationship(back_populates="file", cascade="all, delete-orphan")


class CodeChunk(Base):
    __tablename__ = "code_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("code_files.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    start_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_line: Mapped[int | None] = mapped_column(Integer, nullable=True)
    symbol_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    chroma_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    file: Mapped["CodeFile"] = relationship(back_populates="chunks")


class CallGraphEdge(Base):
    __tablename__ = "call_graph_edges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repositories.id", ondelete="CASCADE"), index=True
    )
    caller_file: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    caller_function: Mapped[str | None] = mapped_column(String(255), nullable=True)
    callee_file: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    callee_function: Mapped[str | None] = mapped_column(String(255), nullable=True)
    call_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    repository: Mapped["Repository"] = relationship(back_populates="call_graph_edges")
