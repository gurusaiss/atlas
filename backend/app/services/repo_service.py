"""Repository ingestion: ZIP upload and GitHub clone, both landing in upload_tmp_dir."""

import os
import uuid

import git
from fastapi import HTTPException

from app.config import get_settings

settings = get_settings()

ALLOWED_GIT_HOSTS = {"github.com"}


def clone_github_repo(github_url: str, branch: str) -> tuple[str, str]:
    """Clone a public GitHub repo to a fresh directory. Returns (path, commit_sha)."""
    from urllib.parse import urlparse

    parsed = urlparse(github_url)
    if parsed.netloc.lower() not in ALLOWED_GIT_HOSTS:
        raise HTTPException(status_code=400, detail="Only github.com URLs are allowed")

    dest_root = settings.upload_tmp_dir
    os.makedirs(dest_root, exist_ok=True)
    dest_dir = os.path.join(dest_root, str(uuid.uuid4()))

    try:
        repo = git.Repo.clone_from(github_url, dest_dir, branch=branch, depth=1)
    except git.GitCommandError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to clone repository: {exc}") from exc

    commit_sha = repo.head.commit.hexsha
    return dest_dir, commit_sha
