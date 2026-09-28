import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.deps import get_current_user
from app.models.job import AgentResult, Job
from app.models.project import Project
from app.models.report import GuardrailEvent
from app.models.repository import Repository
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.job import JobCreate, JobResponse
from app.tasks.analysis_tasks import run_full_analysis
from app.utils.sse import sse_event

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

SSE_POLL_INTERVAL_SECONDS = 1.5
SSE_MAX_DURATION_SECONDS = 900  # generous upper bound; a stalled job shouldn't hold the connection forever


async def _get_owned_job(db: AsyncSession, job_id: uuid.UUID, user: User) -> Job:
    job = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    project = await db.get(Project, job.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this job")
    return job


@router.post("", response_model=JobResponse, status_code=201)
@limiter.limit("10/hour")
async def create_job(
    request: Request,
    body: JobCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Each job triggers a real LangGraph pipeline spending real (free-tier, but
    # rate-limited-upstream) LLM tokens across Gemini/Groq/Mistral. Without a
    # cap here, one authenticated user scripting this endpoint in a loop could
    # exhaust the shared free-tier quota for every user in minutes.
    repository = await db.get(Repository, body.repository_id)
    if repository is None:
        raise HTTPException(status_code=404, detail="Repository not found")

    project = await db.get(Project, repository.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this repository")

    if repository.status not in ("ready", "pending"):
        raise HTTPException(status_code=400, detail=f"Repository is not ready (status={repository.status})")

    job = Job(
        project_id=project.id,
        repository_id=repository.id,
        job_type=body.job_type,
        status="queued",
        is_demo=project.is_demo,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    task = run_full_analysis.delay(str(job.id))
    job.celery_task_id = task.id
    await db.commit()
    await db.refresh(job)

    return job


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Job)
        .join(Project, Job.project_id == Project.id)
        .where(Project.user_id == user.id)
        .order_by(Job.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Job.status == status_filter)
    result = await db.scalars(stmt)
    return result.all()


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    return await _get_owned_job(db, job_id, user)


async def _job_event_stream(job_id: uuid.UUID):
    seen_agent_result_ids: set[uuid.UUID] = set()
    seen_guardrail_event_ids: set[uuid.UUID] = set()
    elapsed = 0.0

    async with AsyncSessionLocal() as db:
        while elapsed < SSE_MAX_DURATION_SECONDS:
            # expire_all() forces SQLAlchemy to reload from the DB on next access
            # rather than serving stale cached values from the previous poll.
            db.expire_all()

            job = await db.get(Job, job_id)
            if job is None:
                yield sse_event("error", {"message": "Job not found"})
                return

            agent_results = (
                await db.scalars(select(AgentResult).where(AgentResult.job_id == job_id))
            ).all()

            for ar in agent_results:
                if ar.id in seen_agent_result_ids or ar.status not in ("completed", "failed", "skipped"):
                    continue
                seen_agent_result_ids.add(ar.id)
                yield sse_event(
                    "agent_complete",
                    {
                        "agent": ar.agent_type,
                        "status": ar.status,
                        "confidence": ar.confidence_score,
                        "tokens_used": ar.tokens_used,
                    },
                )

            guardrail_events = (
                await db.scalars(select(GuardrailEvent).where(GuardrailEvent.job_id == job_id))
            ).all()
            for ge in guardrail_events:
                if ge.id in seen_guardrail_event_ids:
                    continue
                seen_guardrail_event_ids.add(ge.id)
                yield sse_event(
                    "guardrail_event",
                    {
                        "agent": ge.agent_type,
                        "check_type": ge.check_type,
                        "action": ge.action_taken,
                        "confidence": ge.confidence,
                    },
                )

            yield sse_event(
                "progress",
                {
                    "status": job.status,
                    "percent": job.progress,
                    "current_agent": job.current_agent,
                    "tokens": job.total_tokens_used,
                    "rate_limit_hits": job.rate_limit_hits,
                },
            )

            if job.status == "completed":
                yield sse_event("complete", {"job_id": str(job.id)})
                return
            if job.status in ("failed", "cancelled"):
                yield sse_event("error", {"message": job.error_message or job.status})
                return

            await asyncio.sleep(SSE_POLL_INTERVAL_SECONDS)
            elapsed += SSE_POLL_INTERVAL_SECONDS

    yield sse_event("error", {"message": "Stream timed out waiting for job completion"})


@router.get("/{job_id}/stream")
async def stream_job(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)  # auth/ownership check before opening the stream
    return StreamingResponse(_job_event_stream(job_id), media_type="text/event-stream")


@router.delete("/{job_id}", status_code=204)
async def cancel_job(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    job = await _get_owned_job(db, job_id, user)
    if job.status in ("queued", "running"):
        from app.tasks.celery_app import celery_app

        if job.celery_task_id:
            celery_app.control.revoke(job.celery_task_id, terminate=True)
        job.status = "cancelled"
        await db.commit()
