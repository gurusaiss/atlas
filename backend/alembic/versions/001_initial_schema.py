"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("role", sa.String(50), server_default="developer"),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("failed_login_attempts", sa.Integer, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_demo", sa.Boolean, server_default=sa.false()),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "repositories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("github_url", sa.String(500)),
        sa.Column("upload_path", sa.String(500)),
        sa.Column("primary_language", sa.String(50)),
        sa.Column("total_files", sa.Integer, server_default="0"),
        sa.Column("total_loc", sa.Integer, server_default="0"),
        sa.Column("commit_sha", sa.String(100)),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("parse_error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "code_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "repository_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repositories.id", ondelete="CASCADE"),
        ),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("language", sa.String(50)),
        sa.Column("loc", sa.Integer, server_default="0"),
        sa.Column("cyclomatic_complexity", sa.Float, server_default="0"),
        sa.Column("cognitive_complexity", sa.Float, server_default="0"),
        sa.Column("coupling_score", sa.Float, server_default="0"),
        sa.Column("cohesion_score", sa.Float, server_default="0"),
        sa.Column("technical_debt_minutes", sa.Float, server_default="0"),
        sa.Column("is_entry_point", sa.Boolean, server_default=sa.false()),
        sa.Column("function_count", sa.Integer, server_default="0"),
        sa.Column("class_count", sa.Integer, server_default="0"),
        sa.Column("parsed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "code_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("code_files.id", ondelete="CASCADE")
        ),
        sa.Column("chunk_index", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("chunk_type", sa.String(50)),
        sa.Column("start_line", sa.Integer),
        sa.Column("end_line", sa.Integer),
        sa.Column("symbol_name", sa.String(255)),
        sa.Column("chroma_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "call_graph_edges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "repository_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("repositories.id", ondelete="CASCADE"),
        ),
        sa.Column("caller_file", sa.String(1000)),
        sa.Column("caller_function", sa.String(255)),
        sa.Column("callee_file", sa.String(1000)),
        sa.Column("callee_function", sa.String(255)),
        sa.Column("call_count", sa.Integer, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id")),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id")),
        sa.Column("job_type", sa.String(100), server_default="full_analysis"),
        sa.Column("status", sa.String(50), server_default="queued"),
        sa.Column("progress", sa.Integer, server_default="0"),
        sa.Column("current_agent", sa.String(100)),
        sa.Column("current_step", sa.String(255)),
        sa.Column("total_tokens_used", sa.Integer, server_default="0"),
        sa.Column("gemini_tokens", sa.Integer, server_default="0"),
        sa.Column("groq_tokens", sa.Integer, server_default="0"),
        sa.Column("mistral_tokens", sa.Integer, server_default="0"),
        sa.Column("rate_limit_hits", sa.Integer, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("error_message", sa.Text),
        sa.Column("is_demo", sa.Boolean, server_default=sa.false()),
        sa.Column("celery_task_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "agent_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE")),
        sa.Column("agent_type", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("output", postgresql.JSONB),
        sa.Column("output_markdown", sa.Text),
        sa.Column("tokens_used", sa.Integer, server_default="0"),
        sa.Column("llm_model", sa.String(100)),
        sa.Column("execution_time_seconds", sa.Float),
        sa.Column("confidence_score", sa.Float),
        sa.Column("retry_count", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "agent_result_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agent_results.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id")),
        sa.Column("repository_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("repositories.id")),
        sa.Column("finding_type", sa.String(100)),
        sa.Column("category", sa.String(100)),
        sa.Column("severity", sa.String(50)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("file_path", sa.String(1000)),
        sa.Column("line_start", sa.Integer),
        sa.Column("line_end", sa.Integer),
        sa.Column("code_snippet", sa.Text),
        sa.Column("suggested_fix", sa.Text),
        sa.Column("confidence", sa.Float, server_default="1.0"),
        sa.Column("is_false_positive", sa.Boolean, server_default=sa.false()),
        sa.Column("false_positive_reason", sa.Text),
        sa.Column("owasp_category", sa.String(50)),
        sa.Column("cwe_id", sa.String(50)),
        sa.Column("source", sa.String(50), server_default="llm"),
        sa.Column("semgrep_rule_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="CASCADE")),
        sa.Column("report_type", sa.String(100)),
        sa.Column("title", sa.String(255)),
        sa.Column("content_markdown", sa.Text),
        sa.Column("content_json", postgresql.JSONB),
        sa.Column("pdf_path", sa.String(500)),
        sa.Column("word_count", sa.Integer, server_default="0"),
        sa.Column("is_demo", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "guardrail_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id")),
        sa.Column("agent_type", sa.String(100)),
        sa.Column("check_type", sa.String(100)),
        sa.Column("action_taken", sa.String(100)),
        sa.Column("confidence", sa.Float),
        sa.Column("original_length", sa.Integer),
        sa.Column("processed_length", sa.Integer),
        sa.Column("details", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("idx_code_files_repo", "code_files", ["repository_id"])
    op.create_index("idx_code_chunks_file", "code_chunks", ["file_id"])
    op.create_index("idx_jobs_project", "jobs", ["project_id"])
    op.create_index("idx_jobs_status", "jobs", ["status"])
    op.create_index("idx_agent_results_job", "agent_results", ["job_id"])
    op.create_index("idx_findings_job", "findings", ["job_id"])
    op.create_index("idx_findings_severity", "findings", ["severity"])
    op.create_index("idx_findings_type", "findings", ["finding_type"])
    op.create_index("idx_guardrail_events_job", "guardrail_events", ["job_id"])
    op.create_index("idx_call_graph_repo", "call_graph_edges", ["repository_id"])
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_refresh_tokens_user", "refresh_tokens", ["user_id"])
    op.create_index("idx_projects_user", "projects", ["user_id"])


def downgrade() -> None:
    op.drop_table("guardrail_events")
    op.drop_table("reports")
    op.drop_table("findings")
    op.drop_table("agent_results")
    op.drop_table("jobs")
    op.drop_table("call_graph_edges")
    op.drop_table("code_chunks")
    op.drop_table("code_files")
    op.drop_table("repositories")
    op.drop_table("projects")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
