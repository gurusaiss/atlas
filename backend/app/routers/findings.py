import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.finding import Finding
from app.models.job import Job
from app.models.project import Project
from app.models.user import User
from app.schemas.finding import FindingResponse, FindingUpdate

router = APIRouter(prefix="/api/v1/findings", tags=["findings"])


def _owned_findings_base(user: User):
    """Base query joining Finding -> Job -> Project, scoped to the current user's projects."""
    return select(Finding).join(Job, Finding.job_id == Job.id).join(Project, Job.project_id == Project.id).where(
        Project.user_id == user.id
    )


@router.get("", response_model=list[FindingResponse])
async def list_findings(
    job_id: uuid.UUID | None = None,
    repository_id: uuid.UUID | None = None,
    severity: str | None = None,
    finding_type: str | None = None,
    category: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = _owned_findings_base(user)
    if job_id:
        stmt = stmt.where(Finding.job_id == job_id)
    if repository_id:
        stmt = stmt.where(Finding.repository_id == repository_id)
    if severity:
        stmt = stmt.where(Finding.severity == severity)
    if finding_type:
        stmt = stmt.where(Finding.finding_type == finding_type)
    if category:
        stmt = stmt.where(Finding.category == category)

    stmt = stmt.order_by(Finding.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.scalars(stmt)
    return result.all()


@router.get("/stats")
async def findings_stats(
    job_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def _grouped(column):
        q = (
            select(column, func.count(Finding.id))
            .join(Job, Finding.job_id == Job.id)
            .join(Project, Job.project_id == Project.id)
            .where(Project.user_id == user.id)
        )
        if job_id:
            q = q.where(Finding.job_id == job_id)
        return q.group_by(column)

    severity_rows = (await db.execute(_grouped(Finding.severity))).all()
    type_rows = (await db.execute(_grouped(Finding.finding_type))).all()
    category_rows = (await db.execute(_grouped(Finding.category))).all()

    return {
        "by_severity": {row[0] or "unknown": row[1] for row in severity_rows},
        "by_type": {row[0] or "unknown": row[1] for row in type_rows},
        "by_category": {row[0] or "unknown": row[1] for row in category_rows},
    }


@router.patch("/{finding_id}", response_model=FindingResponse)
async def update_finding(
    finding_id: uuid.UUID,
    body: FindingUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    finding = await db.scalar(_owned_findings_base(user).where(Finding.id == finding_id))
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding.is_false_positive = body.is_false_positive
    finding.false_positive_reason = body.false_positive_reason
    await db.commit()
    await db.refresh(finding)
    return finding
