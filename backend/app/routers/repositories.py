import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models.project import Project
from app.models.repository import CallGraphEdge, CodeFile, Repository
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.repository import RepositoryGithubCreate, RepositoryDetailResponse, RepositoryResponse
from app.services.repo_service import clone_github_repo
from app.utils.file_utils import save_and_extract_zip

router = APIRouter(tags=["repositories"])
settings = get_settings()


async def _get_owned_project(db: AsyncSession, project_id: uuid.UUID, user: User) -> Project:
    project = await db.get(Project, project_id)
    if project is None or project.is_deleted:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this project")
    return project


async def _get_owned_repository(db: AsyncSession, repository_id: uuid.UUID, user: User) -> Repository:
    repository = await db.get(Repository, repository_id)
    if repository is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    project = await db.get(Project, repository.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this repository")
    return repository


@router.get("/api/v1/projects/{project_id}/repositories", response_model=list[RepositoryResponse])
async def list_repositories(
    project_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_project(db, project_id, user)
    result = await db.scalars(
        select(Repository)
        .where(Repository.project_id == project_id)
        .order_by(Repository.created_at.desc())
    )
    return result.all()


@router.post(
    "/api/v1/projects/{project_id}/repositories/upload",
    response_model=RepositoryResponse,
    status_code=201,
)
@limiter.limit("20/hour")
async def upload_repository(
    request: Request,
    project_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_owned_project(db, project_id, user)
    extract_dir = await save_and_extract_zip(file, settings.upload_tmp_dir)

    repository = Repository(
        project_id=project_id,
        name=file.filename.rsplit(".", 1)[0],
        upload_path=extract_dir,
        status="pending",
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)

    # Parsing itself runs as the first step of the LangGraph pipeline when the
    # user starts a job (POST /jobs) -- this just registers the repo as "pending".
    return repository


@router.post(
    "/api/v1/projects/{project_id}/repositories/github",
    response_model=RepositoryResponse,
    status_code=201,
)
@limiter.limit("20/hour")
async def add_github_repository(
    request: Request,
    project_id: uuid.UUID,
    body: RepositoryGithubCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_owned_project(db, project_id, user)
    clone_dir, commit_sha = clone_github_repo(body.github_url, body.branch)

    repo_name = body.github_url.rstrip("/").rsplit("/", 1)[-1].removesuffix(".git")
    repository = Repository(
        project_id=project_id,
        name=repo_name,
        github_url=body.github_url,
        upload_path=clone_dir,
        commit_sha=commit_sha,
        status="pending",
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)

    return repository


@router.get("/api/v1/repositories/{repository_id}", response_model=RepositoryDetailResponse)
async def get_repository(
    repository_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    repository = await _get_owned_repository(db, repository_id, user)
    await db.refresh(repository, attribute_names=["code_files"])
    return repository


@router.get("/api/v1/repositories/{repository_id}/call-graph")
async def get_call_graph(
    repository_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    """Nodes (files + complexity/LOC) and edges (function calls) for the frontend's
    force-directed call-graph viewer. Entry points are files with no incoming edges
    that also aren't purely orphaned (heuristic used client-side for node styling)."""
    await _get_owned_repository(db, repository_id, user)

    code_files = (
        await db.scalars(select(CodeFile).where(CodeFile.repository_id == repository_id))
    ).all()
    edges = (
        await db.scalars(select(CallGraphEdge).where(CallGraphEdge.repository_id == repository_id))
    ).all()

    return {
        "nodes": [
            {
                "file_path": cf.file_path,
                "language": cf.language,
                "loc": cf.loc,
                "cyclomatic_complexity": cf.cyclomatic_complexity,
                "coupling_score": cf.coupling_score,
                "is_entry_point": cf.is_entry_point,
            }
            for cf in code_files
        ],
        "edges": [
            {
                "caller_file": e.caller_file,
                "caller_function": e.caller_function,
                "callee_file": e.callee_file,
                "callee_function": e.callee_function,
                "call_count": e.call_count,
            }
            for e in edges
        ],
    }


@router.delete("/api/v1/repositories/{repository_id}", status_code=204)
async def delete_repository(
    repository_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    repository = await _get_owned_repository(db, repository_id, user)
    await db.delete(repository)
    await db.commit()
