import os
import psycopg
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://anushka@127.0.0.1:5432/ai_audit_copilot")


def get_db_connection():
    return psycopg.connect(DATABASE_URL)


class AuditorContact(BaseModel):
    name: str
    firm: str
    email: str


class StakeholderResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role_title: str


class RequestResponse(BaseModel):
    id: str
    engagement_id: str
    control_ref: str
    title: str
    description: str
    stakeholder_id: str
    status: str
    due_date: str
    sent_at: str | None
    reminder_count: int
    last_activity_at: str
    files: list[dict] = []


class UploadLookupResponse(BaseModel):
    kind: str
    request: RequestResponse | None = None
    stakeholder: StakeholderResponse | None = None
    auditor: AuditorContact | None = None


class RequestDetailResponse(BaseModel):
    request: RequestResponse
    stakeholder: StakeholderResponse


def lookup_upload(token: str) -> UploadLookupResponse:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, engagement_id, stakeholder_id, control_ref, title, description, status, due_date, sent_at, reminder_count, last_activity_at FROM evidence_requests WHERE token = %s",
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return UploadLookupResponse(kind="invalid")

            request = RequestResponse(
                id=row[0],
                engagement_id=row[1],
                stakeholder_id=row[2],
                control_ref=row[3],
                title=row[4],
                description=row[5],
                status=row[6],
                due_date=row[7].isoformat() if row[7] else "",
                sent_at=row[8].isoformat() if row[8] else None,
                reminder_count=row[9],
                last_activity_at=row[10].isoformat() if row[10] else "",
                files=[],
            )

            cur.execute(
                "SELECT id, full_name, email, role_title FROM stakeholders WHERE id = %s",
                (request.stakeholder_id,),
            )
            stakeholder_row = cur.fetchone()
            stakeholder = None
            if stakeholder_row:
                stakeholder = StakeholderResponse(
                    id=stakeholder_row[0],
                    full_name=stakeholder_row[1],
                    email=stakeholder_row[2],
                    role_title=stakeholder_row[3],
                )

            return UploadLookupResponse(
                kind="active",
                request=request,
                stakeholder=stakeholder,
                auditor=AuditorContact(
                    name="Anjali Rao",
                    firm="Rao & Associates LLP",
                    email="arao@raoassociates.example",
                ),
            )


def get_request_detail(request_id: str) -> RequestDetailResponse | None:
    """Powers the auditor-facing review panel (GET /evidence-requests/{id}),
    as opposed to lookup_upload above which is keyed by magic-link token for
    the client-facing upload page. Unlike lookup_upload, this actually
    populates `files` from evidence_files — the review panel needs the real
    submitted-file list, the upload page doesn't."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, engagement_id, stakeholder_id, control_ref, title, description, status, due_date, sent_at, reminder_count, last_activity_at FROM evidence_requests WHERE id = %s",
                (request_id,),
            )
            row = cur.fetchone()
            if not row:
                return None

            stakeholder_id = row[2]

            cur.execute(
                "SELECT id, filename, path, uploaded_at FROM evidence_files WHERE evidence_request_id = %s ORDER BY uploaded_at DESC",
                (request_id,),
            )
            files = []
            for file_id, filename, path, uploaded_at in cur.fetchall():
                try:
                    size_bytes = os.path.getsize(path)
                except OSError:
                    size_bytes = 0
                files.append(
                    {
                        "id": file_id,
                        "filename": filename,
                        # only PDFs are accepted by the upload endpoint today
                        "mime_type": "application/pdf",
                        "size_bytes": size_bytes,
                        # page count isn't stored anywhere yet
                        "page_count": None,
                        "uploaded_at": uploaded_at.isoformat() if uploaded_at else "",
                        # not tracked per-file — the upload link is only ever
                        # sent to the one stakeholder on the request
                        "uploaded_by_stakeholder_id": stakeholder_id,
                    }
                )

            request = RequestResponse(
                id=row[0],
                engagement_id=row[1],
                stakeholder_id=stakeholder_id,
                control_ref=row[3],
                title=row[4],
                description=row[5],
                status=row[6],
                due_date=row[7].isoformat() if row[7] else "",
                sent_at=row[8].isoformat() if row[8] else None,
                reminder_count=row[9],
                last_activity_at=row[10].isoformat() if row[10] else "",
                files=files,
            )

            cur.execute(
                "SELECT id, full_name, email, role_title FROM stakeholders WHERE id = %s",
                (stakeholder_id,),
            )
            stakeholder_row = cur.fetchone()
            if not stakeholder_row:
                return None

            return RequestDetailResponse(
                request=request,
                stakeholder=StakeholderResponse(
                    id=stakeholder_row[0],
                    full_name=stakeholder_row[1],
                    email=stakeholder_row[2],
                    role_title=stakeholder_row[3],
                ),
            )
