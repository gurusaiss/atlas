from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.finding import Finding
from app.models.job import Job
from app.models.project import Project
from app.models.report import GuardrailEvent
from app.models.repository import CodeFile, Repository
from app.models.user import User

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project_ids_subq = select(Project.id).where(Project.user_id == user.id).subquery()

    total_repos = await db.scalar(
        select(func.count(Repository.id)).where(Repository.project_id.in_(select(project_ids_subq)))
    )
    total_jobs = await db.scalar(
        select(func.count(Job.id)).where(Job.project_id.in_(select(project_ids_subq)))
    )

    severity_rows = (
        await db.execute(
            select(Finding.severity, func.count(Finding.id))
            .join(Job, Finding.job_id == Job.id)
            .where(Job.project_id.in_(select(project_ids_subq)))
            .group_by(Finding.severity)
        )
    ).all()

    avg_complexity = await db.scalar(
        select(func.avg(CodeFile.cyclomatic_complexity))
        .join(Repository, CodeFile.repository_id == Repository.id)
        .where(Repository.project_id.in_(select(project_ids_subq)))
    )
    avg_debt = await db.scalar(
        select(func.avg(CodeFile.technical_debt_minutes))
        .join(Repository, CodeFile.repository_id == Repository.id)
        .where(Repository.project_id.in_(select(project_ids_subq)))
    )

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    guardrail_events_today = await db.scalar(
        select(func.count(GuardrailEvent.id))
        .join(Job, GuardrailEvent.job_id == Job.id)
        .where(Job.project_id.in_(select(project_ids_subq)), GuardrailEvent.created_at >= today_start)
    )

    return {
        "total_repos": total_repos or 0,
        "total_jobs": total_jobs or 0,
        "total_findings_by_severity": {row[0] or "unknown": row[1] for row in severity_rows},
        "avg_complexity": round(avg_complexity, 2) if avg_complexity else 0.0,
        "avg_debt_minutes": round(avg_debt, 2) if avg_debt else 0.0,
        "guardrail_events_today": guardrail_events_today or 0,
    }


@router.get("/guardrails")
async def guardrail_analytics(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project_ids_subq = select(Project.id).where(Project.user_id == user.id).subquery()

    rows = (
        await db.execute(
            select(GuardrailEvent.check_type, GuardrailEvent.action_taken, func.count(GuardrailEvent.id))
            .join(Job, GuardrailEvent.job_id == Job.id)
            .where(Job.project_id.in_(select(project_ids_subq)))
            .group_by(GuardrailEvent.check_type, GuardrailEvent.action_taken)
        )
    ).all()

    return [{"check_type": r[0], "action_taken": r[1], "count": r[2]} for r in rows]


@router.get("/tokens")
async def token_analytics(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project_ids_subq = select(Project.id).where(Project.user_id == user.id).subquery()

    rows = (
        await db.execute(
            select(
                func.date(Job.created_at),
                func.sum(Job.gemini_tokens),
                func.sum(Job.groq_tokens),
                func.sum(Job.mistral_tokens),
            )
            .where(Job.project_id.in_(select(project_ids_subq)))
            .group_by(func.date(Job.created_at))
            .order_by(func.date(Job.created_at))
        )
    ).all()

    return [
        {"date": str(r[0]), "gemini_tokens": r[1] or 0, "groq_tokens": r[2] or 0, "mistral_tokens": r[3] or 0}
        for r in rows
    ]
