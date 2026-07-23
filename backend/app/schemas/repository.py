import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class RepositoryGithubCreate(BaseModel):
    github_url: str = Field(min_length=1, max_length=500)
    branch: str = Field(default="main", max_length=100)

    @field_validator("github_url")
    @classmethod
    def must_be_github(cls, v: str) -> str:
        normalized = v.strip().lower()
        if not (normalized.startswith("https://github.com/") or normalized.startswith("http://github.com/")):
            raise ValueError("Only public github.com repository URLs are allowed")
        return v.strip()


class RepositoryResponse(BaseModel):
    id: uuid.UUID
    name: str
    github_url: str | None
    upload_path: str | None
    primary_language: str | None
    total_files: int
    total_loc: int
    commit_sha: str | None
    status: str
    parse_error: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CodeFileResponse(BaseModel):
    id: uuid.UUID
    file_path: str
    language: str | None
    loc: int
    cyclomatic_complexity: float
    coupling_score: float
    cohesion_score: float
    technical_debt_minutes: float
    is_entry_point: bool
    function_count: int
    class_count: int

    model_config = {"from_attributes": True}


class RepositoryDetailResponse(RepositoryResponse):
    code_files: list[CodeFileResponse] = []
