import uuid
from datetime import datetime

from pydantic import BaseModel


class JobCreate(BaseModel):
    repository_id: uuid.UUID
    job_type: str = "full_analysis"


class JobResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    repository_id: uuid.UUID
    job_type: str
    status: str
    progress: int
    current_agent: str | None
    current_step: str | None
    total_tokens_used: int
    rate_limit_hits: int
    error_message: str | None
    is_demo: bool
    created_at: datetime

    model_config = {"from_attributes": True}
