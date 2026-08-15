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
import re
from datetime import datetime
from pypdf import PdfReader
import google.generativeai as genai

dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path, override=True)

from app.upload_lookup import (
    RequestDetailResponse,
    UploadLookupResponse,
    get_request_detail,
    lookup_upload,
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://anushka@127.0.0.1:5432/ai_audit_copilot")
UPLOAD_BASE_URL = os.getenv("UPLOAD_BASE_URL", "http://localhost:3000/upload")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

resend.api_key = RESEND_API_KEY
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


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


@app.get("/evidence-requests/{request_id}", response_model=RequestDetailResponse)
def get_request_detail_route(request_id: str):
    detail = get_request_detail(request_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Evidence request not found")
    return detail


# Catches unfilled template fields like "[DD-MM-YYYY]" or "[Organization
# Name]". Deliberately code-based, not AI judgment — the model will happily
# call a document "complete" even with visible placeholder brackets still in
# it, so this acts as a hard floor underneath whatever it concludes.
PLACEHOLDER_PATTERN = re.compile(r"\[[^\[\]\n]{1,50}\]")

COMPLETENESS_RANK = {"insufficient": 0, "partial": 1, "complete": 2}


def find_unfilled_placeholders(text: str) -> list[str]:
    """Unique bracketed spans that look like unfilled template placeholders.
    Skips brackets containing only digits/punctuation (e.g. "[1]", "[12]")
    since those are almost always citation/footnote refs, not placeholders —
    a real placeholder has at least one letter in it."""
    seen: dict[str, None] = {}
    for match in PLACEHOLDER_PATTERN.findall(text):
        inner = match[1:-1].strip()
        if inner and re.search(r"[A-Za-z]", inner):
            seen.setdefault(match, None)
    return list(seen.keys())


def apply_placeholder_check(parsed: dict, full_text: str) -> dict:
    """Caps completeness_label at "partial" and appends a missing_sections
    note if the document still has unfilled template placeholders — this
    overrides the AI's own completeness judgment, it doesn't just advise it."""
    placeholders = find_unfilled_placeholders(full_text)
    if not placeholders:
        return parsed

    current_label = parsed.get("completeness_label")
    if COMPLETENESS_RANK.get(current_label, COMPLETENESS_RANK["complete"]) > COMPLETENESS_RANK["partial"]:
        parsed["completeness_label"] = "partial"

    missing = parsed.get("missing_sections")
    missing = list(missing) if isinstance(missing, list) else []
    shown = ", ".join(placeholders[:5])
    if len(placeholders) > 5:
        shown += f", +{len(placeholders) - 5} more"
    note = f"Document contains unfilled template fields: {shown}."
    if not any("unfilled template field" in str(m).lower() for m in missing):
        missing.append(note)
    parsed["missing_sections"] = missing
    return parsed


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

    # Prepare Gemini prompt
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

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
        # gemini-1.5-flash is fully retired, and the pinned gemini-2.5-flash
        # is walled off from new API keys ("no longer available to new
        # users"). gemini-flash-latest is a rolling alias Google keeps
        # pointed at whatever flash model is currently servable — confirmed
        # working directly against the REST API (currently resolves to
        # gemini-3.7-flash). Trades version stability for not breaking again
        # the next time a pinned model gets sunset.
        model = genai.GenerativeModel(
            model_name="gemini-flash-latest",
            system_instruction=system_msg,
        )
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.0,
                # gemini-3.7-flash spends part of max_output_tokens on
                # internal "thinking" tokens before the visible answer (seen
                # eating 87 tokens for a 1-token reply in testing) — this SDK
                # version has no thinking-budget control to disable that, so
                # the budget needs enough headroom for both. 800 truncated
                # the JSON mid-response; 4096 leaves real room for it.
                max_output_tokens=4096,
                response_mime_type="application/json",
            ),
        )
        assistant_text = response.text
        # keep the same "raw_response JSONB" shape downstream expects, just
        # sourced from Gemini instead of OpenAI's chat-completions envelope
        body = {
            "provider": "gemini",
            "model_requested": "gemini-flash-latest",
            "model_resolved": getattr(response, "model_version", None),
            "text": assistant_text,
            "finish_reason": str(response.candidates[0].finish_reason) if response.candidates else None,
        }
        parsed = None
        if assistant_text:
            try:
                parsed = json.loads(assistant_text)
            except Exception:
                parsed = None
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"message": "Gemini API request failed", "error": str(exc)})

    # Code-based floor on completeness_label — runs regardless of what the
    # model concluded. See apply_placeholder_check / find_unfilled_placeholders.
    if parsed is not None:
        parsed = apply_placeholder_check(parsed, full_text)

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
