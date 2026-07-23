import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ProjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectStatsResponse(ProjectResponse):
    repository_count: int
    job_count: int
    finding_count: int
