import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.finding import Finding
from app.models.job import Job
from app.models.project import Project
from app.models.report import Report
from app.models.user import User
from app.utils.pdf_generator import generate_report_pdf

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


async def _get_owned_job(db: AsyncSession, job_id: uuid.UUID, user: User) -> Job:
    job = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    project = await db.get(Project, job.project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=403, detail="You do not have access to this job")
    return job


@router.get("/{job_id}")
async def list_reports(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)
    reports = await db.scalars(select(Report).where(Report.job_id == job_id))
    return [
        {"id": r.id, "report_type": r.report_type, "title": r.title, "created_at": r.created_at}
        for r in reports.all()
    ]


@router.get("/{job_id}/markdown")
async def download_markdown(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)
    report = await db.scalar(
        select(Report).where(Report.job_id == job_id).order_by(Report.created_at.desc())
    )
    if report is None:
        raise HTTPException(status_code=404, detail="No report generated for this job yet")

    return Response(
        content=report.content_markdown or "",
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="atlas_report_{job_id}.md"'},
    )


@router.get("/{job_id}/pdf")
async def download_pdf(
    job_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)
):
    await _get_owned_job(db, job_id, user)
    report = await db.scalar(
        select(Report).where(Report.job_id == job_id).order_by(Report.created_at.desc())
    )
    if report is None:
        raise HTTPException(status_code=404, detail="No report generated for this job yet")

    findings = (await db.scalars(select(Finding).where(Finding.job_id == job_id))).all()
    findings_dicts = [
        {
            "severity": f.severity,
            "owasp_category": f.owasp_category,
            "category": f.category,
            "file_path": f.file_path,
            "line_start": f.line_start,
            "title": f.title,
        }
        for f in findings
    ]

    pdf_bytes = generate_report_pdf(report.title or "Atlas Analysis Report", report.content_markdown or "", findings_dicts)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="atlas_report_{job_id}.pdf"'},
    )
