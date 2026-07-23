"""No-auth demo endpoints: instantly load pre-computed results for interview demos.

Per Constraint 4 -- interviewers cannot wait for a live 80-minute analysis.
seed_demo_data.py (Phase 6) populates is_demo=True rows for these three repos;
this router just looks them up, never triggers a fresh analysis.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.job import Job
from app.models.project import Project
from app.models.repository import Repository

router = APIRouter(prefix="/api/v1/demo", tags=["demo"])

DEMO_REPO_DESCRIPTIONS = {
    "legacy_bank_app": {
        "language": "Java",
        "description": "Spring-style banking monolith (~400 LOC) with 5 planted OWASP findings, "
        "including SQL injection and hardcoded credentials.",
    },
    "ecommerce_api": {
        "language": "Python",
        "description": "Flask e-commerce API (~300 LOC) with XSS, IDOR, and missing rate-limiting findings.",
    },
    "small_demo_app": {
        "language": "Python",
        "description": "Minimal Flask app (~110 LOC) -- fast enough to run LIVE in an interview "
        "(under 3 minutes on free-tier LLM rate limits).",
    },
}


@router.get("/repositories")
async def list_demo_repositories(db: AsyncSession = Depends(get_db)):
    repos = await db.scalars(
        select(Repository)
        .join(Project, Repository.project_id == Project.id)
        .where(Project.is_demo.is_(True))
    )
    results = []
    for repo in repos.all():
        meta = DEMO_REPO_DESCRIPTIONS.get(repo.name, {})
        results.append(
            {
                "repository_id": repo.id,
                "name": repo.name,
                "language": meta.get("language", repo.primary_language),
                "description": meta.get("description", ""),
                "total_loc": repo.total_loc,
                "status": repo.status,
            }
        )
    return results


@router.post("/load/{repo_name}")
async def load_demo_result(repo_name: str, db: AsyncSession = Depends(get_db)):
    if repo_name not in DEMO_REPO_DESCRIPTIONS:
        raise HTTPException(status_code=404, detail=f"Unknown demo repository: {repo_name}")

    repo = await db.scalar(
        select(Repository)
        .join(Project, Repository.project_id == Project.id)
        .where(Project.is_demo.is_(True), Repository.name == repo_name)
    )
    if repo is None:
        raise HTTPException(
            status_code=404, detail=f"Demo data for '{repo_name}' not seeded yet. Run seed_demo_data.py."
        )

    job = await db.scalar(
        select(Job)
        .where(Job.repository_id == repo.id, Job.is_demo.is_(True), Job.status == "completed")
        .order_by(Job.created_at.desc())
    )
    if job is None:
        raise HTTPException(status_code=404, detail=f"No completed demo job found for '{repo_name}'")

    return {"job_id": job.id, "repository_id": repo.id, "status": job.status}


@router.get("/status")
async def demo_status(db: AsyncSession = Depends(get_db)):
    repos = await db.scalars(
        select(Repository)
        .join(Project, Repository.project_id == Project.id)
        .where(Project.is_demo.is_(True))
    )
    names = [r.name for r in repos.all()]
    return {"loaded": bool(names), "repos": names}
