import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.job import AgentResult, Job
from app.models.project import Project
from app.models.user import User

router = APIRouter(prefix="/api/v1/jobs", tags=["results"])


async def _get_owned_job(db: AsyncSession, job_id: uuid.UUID, user: User) -> Job:
    job = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    project = await db.get(Project, job.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this job")
    return job


async def _get_agent_result(db: AsyncSession, job_id: uuid.UUID, agent_type: str) -> AgentResult | None:
    return await db.scalar(
        select(AgentResult)
        .where(AgentResult.job_id == job_id, AgentResult.agent_type == agent_type)
        .order_by(AgentResult.created_at.desc())
    )


@router.get("/{job_id}/results")
async def get_all_results(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    job = await _get_owned_job(db, job_id, user)
    results = await db.scalars(select(AgentResult).where(AgentResult.job_id == job.id))
    return [
        {
            "agent_type": r.agent_type,
            "status": r.status,
            "confidence_score": r.confidence_score,
            "execution_time_seconds": r.execution_time_seconds,
            "tokens_used": r.tokens_used,
        }
        for r in results.all()
    ]


@router.get("/{job_id}/documentation")
async def get_documentation(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)
    result = await _get_agent_result(db, job_id, "documentation")
    if result is None:
        raise HTTPException(status_code=404, detail="Documentation not yet generated")
    return {"markdown": result.output_markdown}


@router.get("/{job_id}/decomposition")
async def get_decomposition(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)
    result = await _get_agent_result(db, job_id, "decomposition")
    if result is None:
        raise HTTPException(status_code=404, detail="Decomposition not yet generated")
    return result.output


@router.get("/{job_id}/tests")
async def get_tests(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)
    result = await _get_agent_result(db, job_id, "test_generator")
    if result is None or not result.output:
        return []
    return [
        {"source_file": t.get("source_file"), "test_file": t.get("test_file"), "framework": t.get("framework")}
        for t in result.output
    ]


@router.get("/{job_id}/tests/{test_file:path}")
async def get_test_file(
    job_id: uuid.UUID,
    test_file: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_owned_job(db, job_id, user)
    result = await _get_agent_result(db, job_id, "test_generator")
    if result is None or not result.output:
        raise HTTPException(status_code=404, detail="Test not found")
    for t in result.output:
        if t.get("test_file") == test_file:
            return t
    raise HTTPException(status_code=404, detail="Test file not found")


@router.get("/{job_id}/security")
async def get_security(
    job_id: uuid.UUID,
    severity: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_owned_job(db, job_id, user)
    result = await _get_agent_result(db, job_id, "security")
    findings = result.output if result and result.output else []
    if severity:
        findings = [f for f in findings if f.get("severity") == severity]
    return findings


@router.get("/{job_id}/quality")
async def get_quality(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)
    critic = await _get_agent_result(db, job_id, "critic")
    evaluator = await _get_agent_result(db, job_id, "evaluator")
    return {
        "critic": critic.output if critic else None,
        "evaluation": evaluator.output if evaluator else None,
    }
