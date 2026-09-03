import io
import os
import secrets
import ssl
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import psycopg
import resend
from resend.emails._emails import Emails
from resend.exceptions import ResendError
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi import UploadFile, File
from supabase import create_client
from storage3.exceptions import StorageApiError
import uuid
import json
from datetime import datetime
from pypdf import PdfReader
from groq import Groq

dotenv_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path, override=True)

from app.upload_lookup import (
    RequestDetailResponse,
    UploadLookupResponse,
    get_request_detail,
    list_evidence_files_for_engagement,
    list_requests_for_engagement,
    lookup_upload,
)
from app.services.scope_profiler import compute_scope_multi, get_framework

DATABASE_URL = os.getenv("DATABASE_URL")
UPLOAD_BASE_URL = os.getenv("UPLOAD_BASE_URL", "http://localhost:3000/upload")
# The stakeholder upload page calls this API directly from the browser (see
# apps/web/src/lib/api.ts's uploadEvidenceFile) -- every other frontend call
# is a server-side fetch, which isn't subject to CORS, so this went
# undiscovered until an actual browser submitted a real file.
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM = os.getenv("RESEND_FROM", "onboarding@resend.dev")
# Was GEMINI_API_KEY -- Gemini's free tier is a hard 20 requests/day cap
# per Google Cloud project, confirmed exhausted across multiple fresh
# projects (rotating keys doesn't help; it's a project-level quota, not a
# key-level one). Groq's free tier is materially higher and needs no
# billing info, for the same "one JSON completion per uploaded document"
# job -- see the review pipeline below.
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# llama-3.3-70b-versatile (originally requested) isn't in this account's
# model catalog -- confirmed via client.models.list(), not assumed;
# Groq's lineup turns over. openai/gpt-oss-120b is the largest
# instruction-following chat model actually available, and JSON mode
# verified working against it directly before wiring it in here.
GROQ_MODEL = "openai/gpt-oss-120b"
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET")

# Fail immediately and clearly if required config is missing, rather than
# limping along and surfacing it later as an opaque 500 on whichever request
# happens to touch the missing piece first (e.g. psycopg.connect() failing
# deep inside get_db_connection, or a 502 from Groq/Resend/Supabase on
# first use). DATABASE_URL in particular used to silently fall back to
# "postgresql://anushka@127.0.0.1:5432/ai_audit_copilot" -- hardcoding the
# original developer's own machine username, which is wrong for literally
# any other environment. No more silent fallback: set it explicitly.
REQUIRED_ENV_VARS = {
    "DATABASE_URL": DATABASE_URL,
    "GROQ_API_KEY": GROQ_API_KEY,
    "RESEND_API_KEY": RESEND_API_KEY,
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_STORAGE_BUCKET": SUPABASE_STORAGE_BUCKET,
}


def _check_required_env_vars() -> None:
    missing = [name for name, value in REQUIRED_ENV_VARS.items() if not value]
    if not missing:
        return
    print("=" * 72, file=sys.stderr)
    print("FATAL: missing required environment variable(s):", file=sys.stderr)
    for name in missing:
        print(f"  - {name}", file=sys.stderr)
    print(file=sys.stderr)
    print(f"Set them in {dotenv_path} and restart. See apps/api/README.md.", file=sys.stderr)
    print("=" * 72, file=sys.stderr)
    sys.exit(1)


_check_required_env_vars()

resend.api_key = RESEND_API_KEY
groq_client = Groq(api_key=GROQ_API_KEY)
# service-role key -- server-side only, bypasses bucket RLS. Never expose
# this to the frontend; the web app never talks to Supabase directly.
supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = psycopg.connect(DATABASE_URL)
    yield
    if hasattr(app.state, "db"):
        app.state.db.close()


app = FastAPI(title="AI Audit Copilot API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    industry: str | None = None
    company_size: str | None = None
    description: str | None = None
    frameworks: list[str] = []
    period_start: str
    period_end: str
    lead_auditor: str


VALID_FRAMEWORKS = {"ISO27001", "NIST_CSF", "PCI_DSS"}
VALID_COMPANY_SIZES = {"startup", "smb", "mid_market", "enterprise"}


class CreateEngagementPayload(BaseModel):
    client_name: str
    name: str
    industry: str
    company_size: str
    description: str | None = None
    frameworks: list[str]
    period_start: str
    period_end: str
    lead_auditor: str


def ensure_engagement_schema(cur) -> None:
    """Idempotent, lazy DDL -- same pattern as upload_evidence_file's table
    creation. `framework` (singular) predates multi-framework engagements
    and is now nullable/unused for new rows; `engagement_frameworks` is the
    real source of truth. Backfills any pre-existing engagement (eng_001)
    into the new table from its legacy `framework` value so it keeps
    working without a manual migration step."""
    cur.execute("ALTER TABLE engagements ADD COLUMN IF NOT EXISTS industry TEXT")
    cur.execute("ALTER TABLE engagements ADD COLUMN IF NOT EXISTS company_size TEXT")
    cur.execute("ALTER TABLE engagements ADD COLUMN IF NOT EXISTS description TEXT")
    # engagement ids are random hex (f"eng_{uuid.uuid4().hex}"), not
    # sequential -- ORDER BY id can't stand in for creation order the way it
    # does for a couple of the other tables. Needed once list_engagements()
    # (the post-sign-in redirect target) has more than one row to sort.
    cur.execute("ALTER TABLE engagements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()")
    cur.execute("ALTER TABLE engagements ALTER COLUMN framework DROP NOT NULL")
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS engagement_frameworks (
            engagement_id TEXT NOT NULL REFERENCES engagements(id),
            framework TEXT NOT NULL CHECK (framework IN ('ISO27001', 'NIST_CSF', 'PCI_DSS')),
            PRIMARY KEY (engagement_id, framework)
        )
        """
    )
    # SOC2 dropped from VALID_FRAMEWORKS, NIST_CSF/PCI_DSS added -- widen the
    # CHECK constraint for a table created under the old set too, same
    # idempotent spirit as the ADD COLUMN IF NOT EXISTS calls above.
    cur.execute("ALTER TABLE engagement_frameworks DROP CONSTRAINT IF EXISTS engagement_frameworks_framework_check")
    cur.execute(
        "ALTER TABLE engagement_frameworks ADD CONSTRAINT engagement_frameworks_framework_check "
        "CHECK (framework IN ('ISO27001', 'NIST_CSF', 'PCI_DSS'))"
    )
    cur.execute(
        """
        INSERT INTO engagement_frameworks (engagement_id, framework)
        SELECT id, framework FROM engagements WHERE framework IN ('ISO27001', 'NIST_CSF', 'PCI_DSS')
        ON CONFLICT DO NOTHING
        """
    )


@app.get("/health")
def healthcheck() -> dict[str, Any]:
    return {"status": "ok"}


@app.post("/engagements", response_model=EngagementResponse, status_code=201)
def create_engagement(payload: CreateEngagementPayload) -> EngagementResponse:
    bad_frameworks = set(payload.frameworks) - VALID_FRAMEWORKS
    if bad_frameworks:
        raise HTTPException(status_code=400, detail=f"Unsupported framework(s): {sorted(bad_frameworks)}")
    if not payload.frameworks:
        raise HTTPException(status_code=400, detail="At least one framework is required")
    if payload.company_size not in VALID_COMPANY_SIZES:
        raise HTTPException(status_code=400, detail=f"company_size must be one of {sorted(VALID_COMPANY_SIZES)}")

    engagement_id = f"eng_{uuid.uuid4().hex}"
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_engagement_schema(cur)
        cur.execute(
            """
            INSERT INTO engagements (id, name, client_name, industry, company_size, description, period_start, period_end, lead_auditor)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                engagement_id,
                payload.name,
                payload.client_name,
                payload.industry,
                payload.company_size,
                payload.description,
                payload.period_start,
                payload.period_end,
                payload.lead_auditor,
            ),
        )
        for fw in payload.frameworks:
            cur.execute(
                "INSERT INTO engagement_frameworks (engagement_id, framework) VALUES (%s, %s)",
                (engagement_id, fw),
            )
        db.commit()

    return EngagementResponse(
        id=engagement_id,
        name=payload.name,
        client_name=payload.client_name,
        industry=payload.industry,
        company_size=payload.company_size,
        description=payload.description,
        frameworks=payload.frameworks,
        period_start=payload.period_start,
        period_end=payload.period_end,
        lead_auditor=payload.lead_auditor,
    )


class CreateStakeholderPayload(BaseModel):
    full_name: str
    email: str
    role_title: str


class StakeholderResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role_title: str


def ensure_stakeholder_schema(cur) -> None:
    """Lazy DDL, same pattern as ensure_engagement_schema. stakeholders
    predates multi-engagement support and was a single global list with no
    engagement_id at all -- fine for a one-engagement prototype, wrong the
    moment a second engagement exists (every engagement would see every
    other engagement's contacts). Nullable so any pre-existing rows don't
    break; new rows always set it."""
    cur.execute("ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS engagement_id TEXT REFERENCES engagements(id)")


@app.post("/engagements/{engagement_id}/stakeholders", response_model=StakeholderResponse, status_code=201)
def create_stakeholder(engagement_id: str, payload: CreateStakeholderPayload) -> StakeholderResponse:
    stakeholder_id = f"stk_{uuid.uuid4().hex}"
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_stakeholder_schema(cur)
        cur.execute("SELECT id FROM engagements WHERE id = %s", (engagement_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Engagement not found")
        cur.execute(
            "INSERT INTO stakeholders (id, full_name, email, role_title, engagement_id) VALUES (%s, %s, %s, %s, %s)",
            (stakeholder_id, payload.full_name, payload.email, payload.role_title, engagement_id),
        )
        db.commit()
    return StakeholderResponse(
        id=stakeholder_id, full_name=payload.full_name, email=payload.email, role_title=payload.role_title
    )


@app.get("/engagements/{engagement_id}/stakeholders")
def list_stakeholders(engagement_id: str) -> list[StakeholderResponse]:
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_stakeholder_schema(cur)
        cur.execute(
            "SELECT id, full_name, email, role_title FROM stakeholders WHERE engagement_id = %s ORDER BY full_name",
            (engagement_id,),
        )
        rows = cur.fetchall()
        db.commit()
    return [StakeholderResponse(id=r[0], full_name=r[1], email=r[2], role_title=r[3]) for r in rows]


class CreateEvidenceRequestPayload(BaseModel):
    engagement_id: str
    stakeholder_id: str
    control_ref: str
    title: str
    description: str
    due_date: str


def _create_evidence_request_row(cur, payload: CreateEvidenceRequestPayload) -> dict[str, Any]:
    """Insert + activity-log logic for one evidence request, shared by the
    single-create endpoint and the bulk-create endpoint below. Takes an open
    cursor and does not commit -- single-create commits right after calling
    this once; bulk-create commits once for the whole batch."""
    cur.execute("SELECT id FROM engagements WHERE id = %s", (payload.engagement_id,))
    if cur.fetchone() is None:
        raise HTTPException(status_code=404, detail="Engagement not found")
    cur.execute("SELECT id FROM stakeholders WHERE id = %s", (payload.stakeholder_id,))
    if cur.fetchone() is None:
        raise HTTPException(status_code=404, detail="Stakeholder not found")

    request_id = f"req_{uuid.uuid4().hex}"
    cur.execute(
        """
        INSERT INTO evidence_requests
            (id, engagement_id, stakeholder_id, control_ref, title, description, status, due_date, sent_at, reminder_count, token, last_activity_at)
        VALUES (%s, %s, %s, %s, %s, %s, 'not_sent', %s, NULL, 0, NULL, NOW())
        """,
        (request_id, payload.engagement_id, payload.stakeholder_id, payload.control_ref, payload.title, payload.description, payload.due_date),
    )
    log_activity(cur, request_id, "You", "auditor", "Request created", payload.title)

    return {
        "id": request_id,
        "engagement_id": payload.engagement_id,
        "control_ref": payload.control_ref,
        "title": payload.title,
        "description": payload.description,
        "stakeholder_id": payload.stakeholder_id,
        "status": "not_sent",
        "due_date": payload.due_date,
        "sent_at": None,
        "reminder_count": 0,
        "last_activity_at": datetime.now().isoformat(),
        "files": [],
    }


@app.post("/evidence-requests", status_code=201)
def create_evidence_request(payload: CreateEvidenceRequestPayload) -> dict[str, Any]:
    db = get_db_connection()
    with db.cursor() as cur:
        result = _create_evidence_request_row(cur, payload)
        db.commit()
    return result


class BulkEvidenceRequestItem(BaseModel):
    stakeholder_id: str
    control_ref: str
    title: str
    description: str
    due_date: str


class BulkCreateEvidenceRequestsPayload(BaseModel):
    items: list[BulkEvidenceRequestItem]


# Turns a reviewed RFI draft list (see /engagements/{id}/generate-rfi) into
# real evidence_requests rows -- one transaction for the whole batch, same
# insert + activity-log path as the single-create endpoint above.
@app.post("/engagements/{engagement_id}/evidence-requests/bulk", status_code=201)
def bulk_create_evidence_requests(engagement_id: str, payload: BulkCreateEvidenceRequestsPayload) -> dict[str, Any]:
    db = get_db_connection()
    created = []
    with db.cursor() as cur:
        for item in payload.items:
            row_payload = CreateEvidenceRequestPayload(
                engagement_id=engagement_id,
                stakeholder_id=item.stakeholder_id,
                control_ref=item.control_ref,
                title=item.title,
                description=item.description,
                due_date=item.due_date,
            )
            created.append(_create_evidence_request_row(cur, row_payload))
        db.commit()
    return {"created": created}


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

        # Every pre-existing caller of this endpoint was a seeded request
        # that started life already at "awaiting_upload", so this update
        # never mattered before. Requests created via POST /evidence-requests
        # start at "not_sent" -- this is the transition out of that state,
        # and the only place "sent_at" and "reminder_count" get touched at
        # all right now (a real "send reminder" action would increment
        # reminder_count from here too; not built yet).
        cur.execute(
            "UPDATE evidence_requests SET status = 'awaiting_upload', sent_at = NOW(), last_activity_at = NOW() WHERE id = %s AND status = 'not_sent'",
            (request_id,),
        )
        log_activity(cur, request_id, "You", "auditor", "Request sent", f"Sent to {payload.to_email}")
        db.commit()

    return SendEvidenceRequestResponse(
        id=request_row_id,
        token=token,
        upload_url=upload_url,
        resend_response=resend_response,
    )


VALID_DECISIONS = {"approve", "reject", "request_more"}
DECISION_STATUS = {"approve": "approved", "reject": "rejected", "request_more": "changes_requested"}
DECISION_ACTION = {
    "approve": "Evidence approved",
    "reject": "Evidence rejected",
    "request_more": "More evidence requested",
}


class SubmitDecisionPayload(BaseModel):
    decision: str
    note: str = ""
    decided_by: str


def ensure_review_decisions_schema(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS review_decisions (
            id TEXT PRIMARY KEY,
            request_id TEXT NOT NULL REFERENCES evidence_requests(id),
            decision TEXT NOT NULL CHECK (decision IN ('approve','reject','request_more')),
            note TEXT,
            decided_by TEXT NOT NULL,
            decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


# The review panel's Approve / Reject / Request more evidence buttons used to
# only set local component state ("prototype — nothing was saved") -- no
# review_decisions table existed, and this is the endpoint that writes to
# it. Real persistence: the decision row, the request's status flip, and an
# activity_log entry, all in one commit.
@app.post("/evidence-requests/{request_id}/decision")
def submit_decision(request_id: str, payload: SubmitDecisionPayload) -> dict[str, Any]:
    if payload.decision not in VALID_DECISIONS:
        raise HTTPException(status_code=400, detail=f"decision must be one of {sorted(VALID_DECISIONS)}")

    db = get_db_connection()
    with db.cursor() as cur:
        ensure_review_decisions_schema(cur)
        cur.execute("SELECT id FROM evidence_requests WHERE id = %s", (request_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Evidence request not found")

        decision_id = f"dec_{uuid.uuid4().hex}"
        cur.execute(
            "INSERT INTO review_decisions (id, request_id, decision, note, decided_by) VALUES (%s, %s, %s, %s, %s)",
            (decision_id, request_id, payload.decision, payload.note or None, payload.decided_by),
        )
        cur.execute(
            "UPDATE evidence_requests SET status = %s, last_activity_at = NOW() WHERE id = %s",
            (DECISION_STATUS[payload.decision], request_id),
        )
        log_activity(cur, request_id, payload.decided_by, "auditor", DECISION_ACTION[payload.decision], payload.note or None)
        cur.execute("SELECT decided_at FROM review_decisions WHERE id = %s", (decision_id,))
        decided_at = cur.fetchone()[0]
        db.commit()

    return {
        "id": decision_id,
        "decision": payload.decision,
        "note": payload.note,
        "decided_by": payload.decided_by,
        "decided_at": decided_at.isoformat() if decided_at else "",
    }


@app.get("/engagements", response_model=list[EngagementResponse])
def list_engagements() -> list[EngagementResponse]:
    """Powers the post-sign-in landing redirect (see /engagements/page.tsx):
    no per-user scoping exists yet (lead_auditor is a plain display name,
    not a Clerk user id -- a real multi-tenant fix, not done here), so this
    is every engagement in the database, most recent first."""
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_engagement_schema(cur)
        cur.execute(
            """
            SELECT e.id, e.name, e.client_name, e.industry, e.company_size, e.description,
                   e.period_start, e.period_end, e.lead_auditor,
                   COALESCE(array_agg(f.framework) FILTER (WHERE f.framework IS NOT NULL), '{}')
            FROM engagements e
            LEFT JOIN engagement_frameworks f ON f.engagement_id = e.id
            GROUP BY e.id, e.created_at
            ORDER BY e.created_at DESC NULLS LAST
            """
        )
        rows = cur.fetchall()
        db.commit()
    return [
        EngagementResponse(
            id=r[0], name=r[1], client_name=r[2], industry=r[3], company_size=r[4], description=r[5],
            period_start=r[6].isoformat() if r[6] else "", period_end=r[7].isoformat() if r[7] else "",
            lead_auditor=r[8], frameworks=r[9] or [],
        )
        for r in rows
    ]


@app.get("/engagements/{engagement_id}", response_model=EngagementResponse)
def get_engagement(engagement_id: str) -> EngagementResponse:
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_engagement_schema(cur)
        db.commit()
        cur.execute(
            "SELECT id, name, client_name, industry, company_size, description, period_start, period_end, lead_auditor FROM engagements WHERE id = %s",
            (engagement_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Engagement not found")

        cur.execute(
            "SELECT framework FROM engagement_frameworks WHERE engagement_id = %s ORDER BY framework",
            (engagement_id,),
        )
        frameworks = [r[0] for r in cur.fetchall()]

        return EngagementResponse(
            id=row[0],
            name=row[1],
            client_name=row[2],
            industry=row[3],
            company_size=row[4],
            description=row[5],
            frameworks=frameworks,
            # bug: these come back as datetime.date from psycopg, not str —
            # EngagementResponse.period_start/end are typed str, so this 500'd
            # on every call until now.
            period_start=row[6].isoformat() if row[6] else "",
            period_end=row[7].isoformat() if row[7] else "",
            lead_auditor=row[8],
        )


class ScopeQuestionResponse(BaseModel):
    id: str
    question: str
    help_text: str
    type: str
    options: list[dict]


class FrameworkScopeQuestionsResponse(BaseModel):
    framework_id: str
    questions: list[ScopeQuestionResponse]


@app.get("/frameworks/{framework_id}/scope-questions", response_model=FrameworkScopeQuestionsResponse)
def get_framework_scope_questions(framework_id: str) -> FrameworkScopeQuestionsResponse:
    fw = get_framework(framework_id)
    if fw is None:
        raise HTTPException(status_code=404, detail="Unknown framework")
    return FrameworkScopeQuestionsResponse(
        framework_id=framework_id,
        questions=[
            ScopeQuestionResponse(id=q.id, question=q.question, help_text=q.help_text, type=q.type, options=q.options)
            for q in fw.scope_questions
        ],
    )


class ExcludedControl(BaseModel):
    id: str
    reason: str


class EvidenceChecklistItem(BaseModel):
    document_type: str
    label: str
    reason: str
    required: bool
    maps_to: list[str]


class ScopeResponse(BaseModel):
    applicable_controls: list[str]
    excluded_controls: list[ExcludedControl]
    evidence_checklist: list[EvidenceChecklistItem]


class ComputeScopePayload(BaseModel):
    frameworks: list[str]
    scope_answers: dict[str, dict[str, Any]]


def ensure_engagement_scope_schema(cur) -> None:
    """One row per engagement, replaced (upsert) on rerun -- no
    history/versioning needed for this slice, same as review_decisions'
    "just re-run DDL idempotently" approach elsewhere in this file."""
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS engagement_scope (
            engagement_id TEXT PRIMARY KEY REFERENCES engagements(id),
            frameworks JSONB NOT NULL,
            scope_answers JSONB NOT NULL,
            computed_checklist JSONB NOT NULL,
            computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


@app.post("/engagements/{engagement_id}/scope", response_model=ScopeResponse)
def compute_engagement_scope(engagement_id: str, payload: ComputeScopePayload) -> ScopeResponse:
    bad_frameworks = set(payload.frameworks) - VALID_FRAMEWORKS
    if bad_frameworks:
        raise HTTPException(status_code=400, detail=f"Unsupported framework(s): {sorted(bad_frameworks)}")

    db = get_db_connection()
    with db.cursor() as cur:
        ensure_engagement_scope_schema(cur)
        cur.execute("SELECT id FROM engagements WHERE id = %s", (engagement_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Engagement not found")

        # payload.frameworks uses the API-facing strings (ISO27001/NIST_CSF/
        # PCI_DSS); compute_scope_multi is keyed by the FrameworkDefinition
        # registry's own lowercase ids -- the 1:1 mapping VALID_FRAMEWORKS
        # documents.
        answers_by_registry_key = {fw.lower(): payload.scope_answers.get(fw, {}) for fw in payload.frameworks}
        result = compute_scope_multi(answers_by_registry_key)

        cur.execute(
            """
            INSERT INTO engagement_scope (engagement_id, frameworks, scope_answers, computed_checklist, computed_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (engagement_id) DO UPDATE SET
                frameworks = EXCLUDED.frameworks,
                scope_answers = EXCLUDED.scope_answers,
                computed_checklist = EXCLUDED.computed_checklist,
                computed_at = NOW()
            """,
            (engagement_id, json.dumps(payload.frameworks), json.dumps(payload.scope_answers), json.dumps(result)),
        )
        db.commit()

    return ScopeResponse(**result)


@app.get("/engagements/{engagement_id}/scope", response_model=ScopeResponse)
def get_engagement_scope(engagement_id: str) -> ScopeResponse:
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_engagement_scope_schema(cur)
        cur.execute("SELECT computed_checklist FROM engagement_scope WHERE engagement_id = %s", (engagement_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Scope has not been computed for this engagement")
    return ScopeResponse(**row[0])


class DraftRfiItem(BaseModel):
    control_ref: str
    title: str
    description: str
    due_date: str | None = None


class GenerateRfiResponse(BaseModel):
    items: list[DraftRfiItem]


@app.post("/engagements/{engagement_id}/generate-rfi", response_model=GenerateRfiResponse)
def generate_rfi(engagement_id: str) -> GenerateRfiResponse:
    """Turns the persisted evidence checklist into a draft RFI item list --
    doesn't write to evidence_requests (see /evidence-requests/bulk for
    that). No stakeholder assignment here; the frontend assigns one per row
    before submitting."""
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_engagement_scope_schema(cur)
        cur.execute("SELECT computed_checklist FROM engagement_scope WHERE engagement_id = %s", (engagement_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Scope has not been computed for this engagement")

    items = []
    for entry in row[0]["evidence_checklist"]:
        maps_to = entry.get("maps_to") or []
        control_ref = maps_to[0] if len(maps_to) == 1 else ", ".join(maps_to)
        items.append(DraftRfiItem(control_ref=control_ref, title=entry["label"], description=entry["reason"]))
    return GenerateRfiResponse(items=items)


@app.get("/engagements/{engagement_id}/evidence-requests")
def get_engagement_requests(engagement_id: str):
    return list_requests_for_engagement(engagement_id)


@app.get("/engagements/{engagement_id}/evidence-files")
def get_engagement_evidence_files(engagement_id: str):
    return list_evidence_files_for_engagement(engagement_id)


@app.get("/engagements/{engagement_id}/activity")
def get_engagement_activity(engagement_id: str, limit: int = 20):
    db = get_db_connection()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.request_id, r.title, a.actor, a.actor_type, a.action, a.detail, a.created_at
            FROM activity_log a
            JOIN evidence_requests r ON a.request_id = r.id
            WHERE r.engagement_id = %s
            ORDER BY a.created_at DESC
            LIMIT %s
            """,
            (engagement_id, limit),
        )
        rows = cur.fetchall()
    return [
        {
            "id": row[0],
            "request_id": row[1],
            "request_title": row[2],
            "actor": row[3],
            "actor_type": row[4],
            "action": row[5],
            "detail": row[6],
            "created_at": row[7].isoformat() if row[7] else "",
        }
        for row in rows
    ]


@app.get("/evidence-requests/{request_id}/activity")
def get_request_activity(request_id: str):
    db = get_db_connection()
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, actor, actor_type, action, detail, created_at
            FROM activity_log
            WHERE request_id = %s
            ORDER BY created_at DESC
            """,
            (request_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": row[0],
            "actor": row[1],
            "actor_type": row[2],
            "action": row[3],
            "detail": row[4],
            "created_at": row[5].isoformat() if row[5] else "",
        }
        for row in rows
    ]


@app.get("/evidence-files/{file_id}/preview-url")
def get_evidence_file_preview_url(file_id: str):
    """A short-lived signed URL for the browser to render the original PDF
    directly from Supabase Storage. Nothing in the app could show a file's
    actual content before this -- see SECURITY.md, which needs updating now
    that this exists."""
    db = get_db_connection()
    with db.cursor() as cur:
        cur.execute("SELECT path FROM evidence_files WHERE id = %s", (file_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence file not found")

    try:
        result = supabase_client.storage.from_(SUPABASE_STORAGE_BUCKET).create_signed_url(row[0], 300)
    except StorageApiError as exc:
        raise HTTPException(status_code=502, detail={"message": "Could not sign file URL", "error": str(exc)})
    return {"url": result["signedUrl"], "expires_in": 300}


@app.get("/upload/{token}", response_model=UploadLookupResponse)
def get_upload_lookup(token: str):
    return lookup_upload(token)


@app.get("/evidence-requests/{request_id}", response_model=RequestDetailResponse)
def get_request_detail_route(request_id: str):
    detail = get_request_detail(request_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Evidence request not found")
    return detail


def log_activity(cur, request_id: str, actor: str, actor_type: str, action: str, detail: str | None = None) -> None:
    """Appends one row to activity_log. activity_log has existed as a table
    since seed.py's DDL, but nothing ever wrote to it until now -- the
    dashboard's "recent activity" and each request's activity timeline both
    read real rows from here now instead of showing nothing."""
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS activity_log (
            id TEXT PRIMARY KEY,
            request_id TEXT REFERENCES evidence_requests(id),
            actor TEXT NOT NULL,
            actor_type TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        "INSERT INTO activity_log (id, request_id, actor, actor_type, action, detail) VALUES (%s, %s, %s, %s, %s, %s)",
        (f"act_{uuid.uuid4().hex}", request_id, actor, actor_type, action, detail),
    )


@app.post("/evidence-requests/{request_id}/upload")
def upload_evidence_file(request_id: str, file: UploadFile = File(...)):
    # only accept PDFs for this first-pass implementation
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    file_id = f"file_{uuid.uuid4().hex}"
    storage_key = f"{file_id}.pdf"
    contents = file.file.read()
    size_bytes = len(contents)

    # Uploaded to Supabase Storage, not local disk -- local disk doesn't
    # survive a redeploy and isn't shared across instances/hosts. Nothing is
    # written to apps/api/uploads/ anymore; that directory is legacy.
    try:
        supabase_client.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
            storage_key,
            contents,
            {"content-type": "application/pdf"},
        )
    except StorageApiError as exc:
        raise HTTPException(
            status_code=502,
            detail={"message": "Supabase Storage upload failed", "error": str(exc)},
        )

    # extract text from the PDF -- straight from the in-memory bytes just
    # uploaded, no round trip back to disk or to Supabase needed. Stored
    # alongside the file below so POST /evidence-files/{id}/analyze doesn't
    # need a second Supabase round trip to re-extract it later.
    try:
        reader = PdfReader(io.BytesIO(contents))
        text_parts = []
        for p in reader.pages:
            page_text = p.extract_text() or ""
            text_parts.append(page_text)
        full_text = "\n".join(text_parts)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"message": "Failed to extract PDF text", "error": str(exc)})

    db = get_db_connection()
    # ensure tables exist (simple DDL for local testing)
    with db.cursor() as cur:
        ensure_evidence_files_schema(cur)

        cur.execute(
            "INSERT INTO evidence_files (id, evidence_request_id, filename, path, size_bytes, extracted_text) VALUES (%s, %s, %s, %s, %s, %s)",
            (file_id, request_id, storage_key, storage_key, size_bytes, full_text),
        )

        cur.execute(
            """
            SELECT s.full_name FROM evidence_requests r
            JOIN stakeholders s ON r.stakeholder_id = s.id
            WHERE r.id = %s
            """,
            (request_id,),
        )
        stakeholder_row = cur.fetchone()
        uploader_name = stakeholder_row[0] if stakeholder_row else "Stakeholder"
        log_activity(
            cur,
            request_id,
            uploader_name,
            "stakeholder",
            "Evidence uploaded",
            f"{storage_key} ({size_bytes:,} bytes)",
        )
        db.commit()

    # No AI review here anymore -- upload just stores the file. Analysis is
    # now a separate, control-aware step (see POST
    # /evidence-files/{file_id}/analyze below); the request's status is left
    # exactly as it was before this upload, since there's no review yet for
    # the auditor to act on.
    return {
        "evidence_file": {"id": file_id, "filename": storage_key, "path": storage_key, "size_bytes": size_bytes},
    }


class AnalyzeEvidenceFileResponse(BaseModel):
    id: str
    compliance_status: str
    current_state: str
    gap_description: str
    evidence_quote: str
    risk_level: str
    follow_up_evidence: str
    control_id_matched: str | None = None


def ensure_evidence_files_schema(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS evidence_files (
            id TEXT PRIMARY KEY,
            evidence_request_id TEXT,
            filename TEXT,
            path TEXT,
            size_bytes BIGINT,
            uploaded_at TIMESTAMPTZ DEFAULT NOW()
        )
        """
    )
    # Lazy migration for a table created before size_bytes existed, and
    # before `path` was repurposed to hold a Supabase Storage object key
    # instead of a local filesystem path.
    cur.execute("ALTER TABLE evidence_files ADD COLUMN IF NOT EXISTS size_bytes BIGINT")
    # Holds the PDF's extracted text so /analyze doesn't need a second
    # Supabase round trip to re-fetch and re-extract it later.
    cur.execute("ALTER TABLE evidence_files ADD COLUMN IF NOT EXISTS extracted_text TEXT")


def ensure_ai_reviews_schema(cur) -> None:
    # ai_reviews.evidence_file_id references evidence_files -- that table
    # needs to exist first, and on a database nothing has ever been
    # uploaded to yet, it won't (evidence_files is normally created lazily
    # by the upload endpoint).
    ensure_evidence_files_schema(cur)
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
    # document_type through raw_response above are the old whole-document
    # summary fields the upload-time review used to populate; left null for
    # every row created here since this endpoint asks a narrower,
    # control-scoped question instead (see AnalyzeEvidenceFileResponse).
    cur.execute("ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS compliance_status TEXT")
    cur.execute("ALTER TABLE ai_reviews ADD COLUMN IF NOT EXISTS follow_up_evidence TEXT")


# Narrowed from CyberAssess's build_framework_system_prompt/
# build_framework_user_prompt (one whole framework's controls vs. one full
# assessment) to one control vs. one uploaded document -- same field set
# (compliance_status/current_state/gap_description/evidence_quote) plus
# follow_up_evidence, which that prompt didn't need since it wasn't scoped
# to a single piece of missing evidence.
@app.post("/evidence-files/{file_id}/analyze", response_model=AnalyzeEvidenceFileResponse)
def analyze_evidence_file(file_id: str) -> AnalyzeEvidenceFileResponse:
    db = get_db_connection()
    with db.cursor() as cur:
        ensure_engagement_schema(cur)
        ensure_ai_reviews_schema(cur)
        db.commit()

        cur.execute(
            "SELECT evidence_request_id, extracted_text FROM evidence_files WHERE id = %s",
            (file_id,),
        )
        file_row = cur.fetchone()
        if file_row is None:
            raise HTTPException(status_code=404, detail="Evidence file not found")
        request_id, extracted_text = file_row

        cur.execute(
            "SELECT control_ref, engagement_id FROM evidence_requests WHERE id = %s",
            (request_id,),
        )
        request_row = cur.fetchone()
        if request_row is None:
            raise HTTPException(status_code=404, detail="Evidence request not found")
        control_ref, engagement_id = request_row

        cur.execute("SELECT framework FROM engagement_frameworks WHERE engagement_id = %s", (engagement_id,))
        frameworks = [r[0] for r in cur.fetchall()]

    # control_ref is free-text (see main.py's constraints doc, not a foreign
    # key) -- best-effort lookup against the engagement's registered
    # frameworks, degrading to a generic prompt rather than erroring if
    # nothing matches, so an auditor-typed custom ref never breaks analysis.
    matched_control = None
    for api_framework in frameworks:
        fw = get_framework(api_framework.lower())
        if fw is None:
            continue
        matched_control = fw.get_control(control_ref)
        if matched_control:
            break

    if matched_control:
        control_context = (
            f"Control ID: {matched_control.id}\n"
            f"Title: {matched_control.title}\n"
            f"Description: {matched_control.description}\n"
            f"Reference: {matched_control.reference}"
        )
    else:
        control_context = (
            f'No specific control reference was matched for control_ref "{control_ref}" -- assess '
            "this document on its own merits and note what compliance area it appears to address."
        )

    system_msg = (
        "You are a compliance auditor assessing whether ONE uploaded document satisfies ONE "
        "specific control. Given the control being assessed and the raw extracted text of the "
        "uploaded document, return ONLY a JSON object with the following keys: compliance_status, "
        "current_state, gap_description, evidence_quote, risk_level, follow_up_evidence.\n"
        "- compliance_status: one of \"compliant\", \"partially_compliant\", \"non_compliant\", \"not_assessed\"\n"
        "- current_state: what the document shows the organization currently does (1-2 sentences)\n"
        "- gap_description: what is missing relative to the control; \"No gap identified.\" if compliant\n"
        "- evidence_quote: exact text quoted from the document supporting your assessment, or \"No relevant language found\"\n"
        "- risk_level: one of \"critical\", \"high\", \"medium\", \"low\"\n"
        "- follow_up_evidence: a specific, concrete description of what to collect next if the "
        "control isn't fully met (e.g. \"Provide the Q3 2026 access review log showing "
        "offboarded-user removal within 24 hours\"), never a vague \"provide more documentation\"\n\n"
        f"## Control Being Assessed\n{control_context}\n\n"
        "Ensure the JSON parses cleanly; do not include any extra commentary."
    )

    # Truncate input to a safe size -- same approach as the removed
    # upload-time review.
    max_chars = 20000
    doc_text = (extracted_text or "")[:max_chars]
    prompt = f"Analyze the following document text against the control above:\n---\n{doc_text}\n---\nRespond as JSON per the schema."

    try:
        # Groq's chat-completions API is OpenAI-shaped (messages array,
        # response_format for JSON mode) rather than Gemini's
        # system_instruction/generation_config split -- same prompt, same
        # schema, different envelope.
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        assistant_text = completion.choices[0].message.content
        body = {
            "provider": "groq",
            "model_requested": GROQ_MODEL,
            "model_resolved": completion.model,
            "text": assistant_text,
            "finish_reason": completion.choices[0].finish_reason,
        }
        parsed = None
        if assistant_text:
            try:
                parsed = json.loads(assistant_text)
            except Exception:
                parsed = None
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"message": "Groq API request failed", "error": str(exc)})

    parsed = parsed or {}
    ai_id = f"ai_{uuid.uuid4().hex}"
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO ai_reviews (id, evidence_file_id, compliance_status, follow_up_evidence, raw_response) VALUES (%s,%s,%s,%s,%s)",
            (ai_id, file_id, parsed.get("compliance_status"), parsed.get("follow_up_evidence"), json.dumps(body)),
        )
        # Same transition the removed upload-time review used to make --
        # this is now what tells the auditor there's something to review.
        cur.execute(
            "UPDATE evidence_requests SET status = %s, last_activity_at = NOW() WHERE id = %s",
            ("pending_review", request_id),
        )
        log_activity(
            cur, request_id, "AI review", "ai", "AI analysis completed",
            f"Control {control_ref}: {parsed.get('compliance_status', 'unknown')}",
        )
        db.commit()

    return AnalyzeEvidenceFileResponse(
        id=ai_id,
        compliance_status=parsed.get("compliance_status") or "not_assessed",
        current_state=parsed.get("current_state") or "",
        gap_description=parsed.get("gap_description") or "",
        evidence_quote=parsed.get("evidence_quote") or "",
        risk_level=parsed.get("risk_level") or "medium",
        follow_up_evidence=parsed.get("follow_up_evidence") or "",
        control_id_matched=matched_control.id if matched_control else None,
    )


@app.get("/evidence-requests/{request_id}/review")
def get_evidence_review(request_id: str):
    db = get_db_connection()
    with db.cursor() as cur:
        # ai_reviews is only otherwise created lazily inside /analyze now
        # (upload no longer touches it) -- ensure it exists here too, so
        # this read doesn't 500 on a request that's been uploaded to but
        # never analyzed anywhere in this database's lifetime yet.
        ensure_ai_reviews_schema(cur)
        db.commit()
        cur.execute(
            "SELECT id, filename, path, uploaded_at FROM evidence_files WHERE evidence_request_id = %s ORDER BY uploaded_at DESC LIMIT 1",
            (request_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="No evidence file found for request")
        # `path` is a Supabase Storage object key now, not a filesystem path
        # -- passed through as-is, the frontend doesn't currently render it.
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
