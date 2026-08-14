import os
import secrets
import ssl
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import psycopg
import resend
from resend.emails._emails import Emails
from resend.exceptions import ResendError
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi import UploadFile, File
import shutil
import uuid
import json
from datetime import datetime
from pypdf import PdfReader
import requests as http_requests

dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path, override=True)

from app.upload_lookup import UploadLookupResponse, lookup_upload

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://anushka@127.0.0.1:5432/ai_audit_copilot")
UPLOAD_BASE_URL = os.getenv("UPLOAD_BASE_URL", "http://localhost:3000/upload")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")

resend.api_key = RESEND_API_KEY


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = psycopg.connect(DATABASE_URL)
    yield
    if hasattr(app.state, "db"):
        app.state.db.close()


app = FastAPI(title="AI Audit Copilot API", lifespan=lifespan)


def get_db_connection():
    if not hasattr(app.state, "db"):
        app.state.db = psycopg.connect(DATABASE_URL)
    return app.state.db


class SendEvidenceRequestPayload(BaseModel):
    to_email: str


class SendEvidenceRequestResponse(BaseModel):
    id: str
    token: str
    upload_url: str
    resend_response: dict[str, Any] | None = None


class EngagementResponse(BaseModel):
    id: str
    name: str
    client_name: str
    framework: str
    period_start: str
    period_end: str
    lead_auditor: str


@app.get("/health")
def healthcheck() -> dict[str, Any]:
    return {"status": "ok"}


@app.post("/evidence-requests/{request_id}/send", response_model=SendEvidenceRequestResponse)
def send_magic_link(request_id: str, payload: SendEvidenceRequestPayload) -> SendEvidenceRequestResponse:
    db = get_db_connection()
    with db.cursor() as cur:
        cur.execute(
            "SELECT id, token, engagement_id, stakeholder_id FROM evidence_requests WHERE id = %s",
            (request_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Evidence request not found")

        request_row_id, existing_token, engagement_id, stakeholder_id = row

        token = existing_token or secrets.token_urlsafe(24)
        upload_url = f"{UPLOAD_BASE_URL}/{token}"

        if not existing_token:
            cur.execute(
                "UPDATE evidence_requests SET token = %s WHERE id = %s",
                (token, request_id),
            )
            db.commit()

        resend_response = None
        if RESEND_API_KEY:
            try:
                email_response = Emails.send(
                    {
                        "from": RESEND_FROM,
                        "to": [payload.to_email],
                        "subject": "Your evidence upload link",
                        "html": f"<p>Open your upload link:</p><p><a href=\"{upload_url}\">{upload_url}</a></p>",
                    }
                )
                resend_response = dict(email_response)
            except ResendError as exc:
                error_detail = {
                    "message": "Resend API request failed",
                    "error": str(exc),
                }
                if hasattr(exc, "headers"):
                    error_detail["headers"] = exc.headers
                raise HTTPException(status_code=502, detail=error_detail)
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail={
                        "message": "Could not contact Resend API",
                        "error": str(exc),
                    },
                )

    return SendEvidenceRequestResponse(
        id=request_row_id,
        token=token,
        upload_url=upload_url,
        resend_response=resend_response,
    )


@app.get("/engagements/{engagement_id}", response_model=EngagementResponse)
def get_engagement(engagement_id: str) -> EngagementResponse:
    db = get_db_connection()
    with db.cursor() as cur:
        cur.execute(
            "SELECT id, name, client_name, framework, period_start, period_end, lead_auditor FROM engagements WHERE id = %s",
            (engagement_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Engagement not found")

        return EngagementResponse(
            id=row[0],
            name=row[1],
            client_name=row[2],
            framework=row[3],
            period_start=row[4],
            period_end=row[5],
            lead_auditor=row[6],
        )


@app.get("/upload/{token}", response_model=UploadLookupResponse)
def get_upload_lookup(token: str):
    return lookup_upload(token)


@app.post("/evidence-requests/{request_id}/upload")
def upload_evidence_file(request_id: str, file: UploadFile = File(...)):
    # only accept PDFs for this first-pass implementation
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    file_id = f"file_{uuid.uuid4().hex}"
    filename = f"{file_id}.pdf"
    file_path = uploads_dir / filename

    # save uploaded file to disk
    with open(file_path, "wb") as out_f:
        shutil.copyfileobj(file.file, out_f)

    db = get_db_connection()
    # ensure tables exist (simple DDL for local testing)
    with db.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS evidence_files (
                id TEXT PRIMARY KEY,
                evidence_request_id TEXT,
                filename TEXT,
                path TEXT,
                uploaded_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_reviews (
                id TEXT PRIMARY KEY,
                evidence_file_id TEXT REFERENCES evidence_files(id),
                document_type TEXT,
                summary TEXT,
                suggested_controls JSONB,
                missing_sections JSONB,
                completeness_label TEXT,
                raw_response JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        cur.execute(
            "INSERT INTO evidence_files (id, evidence_request_id, filename, path) VALUES (%s, %s, %s, %s)",
            (file_id, request_id, filename, str(file_path)),
        )
        db.commit()

    # extract text from the PDF
    try:
        reader = PdfReader(str(file_path))
        text_parts = []
        for p in reader.pages:
            page_text = p.extract_text() or ""
            text_parts.append(page_text)
        full_text = "\n".join(text_parts)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"message": "Failed to extract PDF text", "error": str(exc)})

    # Prepare OpenAI prompt
    openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY") or os.getenv("OPENAIAPI_KEY")
    if not openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    system_msg = (
        "You are a compliance reviewer. Given the raw extracted text of a policy document, "
        "return ONLY a JSON object with the following keys: document_type, summary, suggested_controls, missing_sections, completeness_label. "
        "- document_type: short label like \"access control policy\"\n"
        "- summary: 3-5 sentence summary\n"
        "- suggested_controls: array of objects {control_name, confidence_label, rationale} where confidence_label is one of strong_match/partial_match/weak_match\n"
        "- missing_sections: array of strings\n"
        "- completeness_label: one of complete/partial/insufficient\n"
        "Ensure the JSON parses cleanly; do not include any extra commentary."
    )

    # Truncate input to a safe size
    max_chars = 20000
    doc_text = full_text[:max_chars]

    prompt = f"Analyze the following document text:\n---\n{doc_text}\n---\nRespond as JSON per the schema."

    try:
        resp = http_requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
                "max_tokens": 800,
            },
            timeout=60,
        )
        resp.raise_for_status()
        body = resp.json()
        # extract assistant content
        assistant_text = None
        if "choices" in body and len(body["choices"]) > 0:
            assistant_text = body["choices"][0].get("message", {}).get("content")
        # try parse JSON
        parsed = None
        if assistant_text:
            try:
                parsed = json.loads(assistant_text)
            except Exception:
                parsed = None
    except http_requests.RequestException as exc:
        raise HTTPException(status_code=502, detail={"message": "OpenAI API request failed", "error": str(exc)})

    # persist ai_review row
    ai_id = f"ai_{uuid.uuid4().hex}"
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO ai_reviews (id, evidence_file_id, document_type, summary, suggested_controls, missing_sections, completeness_label, raw_response) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (
                ai_id,
                file_id,
                parsed.get("document_type") if parsed else None,
                parsed.get("summary") if parsed else None,
                json.dumps(parsed.get("suggested_controls")) if parsed and parsed.get("suggested_controls") is not None else None,
                json.dumps(parsed.get("missing_sections")) if parsed and parsed.get("missing_sections") is not None else None,
                parsed.get("completeness_label") if parsed else None,
                json.dumps(body) if body is not None else None,
            ),
        )
        db.commit()

    return {
        "evidence_file": {"id": file_id, "filename": filename, "path": str(file_path)},
        "ai_review": parsed if parsed else {"raw_response": body},
    }


@app.get("/evidence-requests/{request_id}/review")
def get_evidence_review(request_id: str):
    db = get_db_connection()
    with db.cursor() as cur:
        cur.execute(
            "SELECT id, filename, path, uploaded_at FROM evidence_files WHERE evidence_request_id = %s ORDER BY uploaded_at DESC LIMIT 1",
            (request_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No evidence file found for request")
        file_row = {"id": row[0], "filename": row[1], "path": row[2], "uploaded_at": row[3]}

        cur.execute(
            "SELECT id, document_type, summary, suggested_controls, missing_sections, completeness_label, raw_response, created_at FROM ai_reviews WHERE evidence_file_id = %s ORDER BY created_at DESC LIMIT 1",
            (file_row["id"],),
        )
        r = cur.fetchone()
        review = None
        if r:
            review = {
                "id": r[0],
                "document_type": r[1],
                "summary": r[2],
                "suggested_controls": r[3],
                "missing_sections": r[4],
                "completeness_label": r[5],
                "raw_response": r[6],
                "created_at": r[7],
            }

    return {"evidence_file": file_row, "ai_review": review}
