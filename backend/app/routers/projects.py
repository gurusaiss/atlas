import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.finding import Finding
from app.models.job import Job
from app.models.project import Project
from app.models.repository import Repository
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectStatsResponse, ProjectUpdate

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


async def _get_owned_project(db: AsyncSession, project_id: uuid.UUID, user: User) -> Project:
    project = await db.get(Project, project_id)
    if project is None or project.is_deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this project")
    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Project)
        .where(Project.user_id == user.id, Project.is_deleted.is_(False))
        .order_by(Project.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.scalars(stmt)
    return result.all()


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    body: ProjectCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    project = Project(user_id=user.id, name=body.name, description=body.description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectStatsResponse)
async def get_project(
    project_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    project = await _get_owned_project(db, project_id, user)

    repo_count = await db.scalar(
        select(func.count(Repository.id)).where(Repository.project_id == project.id)
    )
    job_count = await db.scalar(select(func.count(Job.id)).where(Job.project_id == project.id))
    finding_count = await db.scalar(
        select(func.count(Finding.id)).join(Job, Finding.job_id == Job.id).where(Job.project_id == project.id)
    )

    return ProjectStatsResponse(
        **ProjectResponse.model_validate(project).model_dump(),
        repository_count=repo_count or 0,
        job_count=job_count or 0,
        finding_count=finding_count or 0,
    )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = await _get_owned_project(db, project_id, user)
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    project = await _get_owned_project(db, project_id, user)
    project.is_deleted = True
    await db.commit()
