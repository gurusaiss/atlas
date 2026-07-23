import uuid
from datetime import datetime

from pydantic import BaseModel


class FindingResponse(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID | None
    finding_type: str | None
    category: str | None
    severity: str | None
    title: str
    description: str | None
    file_path: str | None
    line_start: int | None
    line_end: int | None
    code_snippet: str | None
    suggested_fix: str | None
    confidence: float
    is_false_positive: bool
    owasp_category: str | None
    cwe_id: str | None
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FindingUpdate(BaseModel):
    is_false_positive: bool
    false_positive_reason: str | None = None
