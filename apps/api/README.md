# apps/api — FastAPI backend

Real backend, running against a local Postgres database. Not yet deployed
(target: Railway/Render).

```
app/
  main.py               # FastAPI app; engagement CRUD, magic-link send,
                         # upload, scope/RFI/bulk-request/analyze/decision
                         # endpoints, activity log, startup config check
  auth.py               # Clerk session-JWT verification (JWKS/RS256) +
                         # auditor-org/allowlist membership check
  upload_lookup.py       # token/id → request/stakeholder/auditor resolution,
                          # and the dashboard's list-all-requests query
  frameworks/            # ISO 27001 / NIST CSF / PCI-DSS control library +
                          # per-framework scope-question definitions
  services/
    scope_profiler.py    # scope answers → excluded controls + evidence checklist
seed.py                  # local test data (1 engagement, 1 evidence request)
tests/                   # smoke tests
uploads/                 # LEGACY — pre-Supabase-migration local test files.
                          # Nothing is written here anymore; gitignored.
```

## What's actually built

- `GET /health` — healthcheck
- `GET /engagements` — every engagement in the database, most recent first,
  for any authenticated auditor (no per-auditor ownership model yet — see
  "Auth" below). Powers the post-sign-in landing redirect.
- `POST /engagements` — create an engagement
- `GET /engagements/{engagement_id}` — engagement lookup
- `GET /engagements/{engagement_id}/evidence-requests` — every real evidence
  request for the engagement, each with its files, latest AI review, and
  latest decision inlined, plus the distinct stakeholders touched. Powers
  the evidence dashboard.
- `GET /engagements/{engagement_id}/evidence-files` — every evidence file
  across the engagement, flattened with its request/control context and a
  *legacy*-shaped AI-review summary (`document_type`/`completeness_label`/
  `flag_count`) — not the richer control-aware fields `POST
  /evidence-files/{id}/analyze` returns; these two views haven't been
  unified yet.
- `GET /engagements/{engagement_id}/activity` / `GET
  /evidence-requests/{request_id}/activity` — real `activity_log` rows,
  most recent first.
- `GET/POST /engagements/{engagement_id}/stakeholders` — engagement contacts
- `POST /evidence-requests` / `POST
  /engagements/{engagement_id}/evidence-requests/bulk` — create one evidence
  request, or atomically bulk-create a whole RFI draft's worth in one call
  (idempotent — see `ensure_bulk_idempotency_schema`), validating that every
  `stakeholder_id` actually belongs to the target engagement before any row
  is inserted.
- `GET /frameworks/{framework_id}/scope-questions` — a framework's scope
  questionnaire (ISO 27001 / NIST CSF / PCI-DSS)
- `POST /engagements/{engagement_id}/scope` — persists the auditor's scope
  answers and computes applicable controls, excluded controls (with a
  reason), and a control-mapped evidence checklist via
  `app/services/scope_profiler.py`
- `GET /engagements/{engagement_id}/scope` — the persisted scope result
- `POST /engagements/{engagement_id}/generate-rfi` — reads the persisted
  scope checklist and returns a draft RFI item list; review/edit-only, writes
  nothing
- `GET /upload/{token}` — resolves a magic-link token to the evidence
  request/stakeholder/auditor, or `{"kind": "invalid"}` if the token doesn't
  match. (Note: doesn't yet distinguish an *expired* token from an *approved*
  one — the DB doesn't track those states here, and tokens never expire.)
- `GET /evidence-requests/{request_id}` — request detail for the review panel
- `POST /evidence-requests/{request_id}/send` — generates (or reuses) a
  magic-link token, emails it via Resend
- `POST /evidence-requests/{request_id}/upload` — accepts a PDF from either
  the stakeholder (matching the request's own upload token) or an
  authenticated auditor (re-upload from the review panel) — see
  `_upload_credential_is_valid`. Uploads it to Supabase Storage and extracts
  text with `pypdf`. **Does not trigger AI review automatically anymore** —
  that used to happen inline on every upload; analysis is now an explicit
  separate call (`POST /evidence-files/{id}/analyze`).
- `POST /evidence-files/{file_id}/analyze` — control-aware AI review: sends
  the file's extracted text plus its request's specific `control_ref`
  (looked up against the ISO 27001/NIST CSF/PCI-DSS control library, with a
  graceful generic fallback if it doesn't match a known control) to Groq
  (`openai/gpt-oss-120b`), and persists `compliance_status`, `current_state`,
  `gap_description`, `evidence_quote`, `risk_level`, and
  `follow_up_evidence` to `ai_reviews`. Rejects blank extracted text and
  malformed model output before persisting anything.
- `GET /evidence-requests/{request_id}/review` — latest uploaded file + its
  AI review for a request
- `GET /evidence-files/{file_id}/preview-url` — a short-lived (5-minute)
  Supabase signed URL so an authenticated auditor can view the original PDF
- `POST /evidence-requests/{request_id}/decision` — persists an
  Approve/Reject/Request-more decision to `review_decisions`, flips the
  request's status, and writes an `activity_log` entry, all in one commit.
  The `decided_by` actor always comes from the verified Clerk token, never
  from the request body.

## Auth

Every auditor-facing route depends on `app/auth.py`'s
`get_current_auditor_id` / `get_current_auditor`: it verifies the caller's
Clerk session JWT against Clerk's own JWKS (RS256, cached, refetched on a
key-rotation miss) and additionally checks that the token belongs to this
firm's auditor org (`CLERK_AUDITOR_ORG_ID`, matched against the token's
`org_id` claim) or allowlist (`CLERK_AUDITOR_USER_IDS`, matched against
`sub`) — a real, currently-valid Clerk session alone is **not** sufficient,
since this app's sign-up page is public. Fails closed: an unconfigured
issuer or auditor org/allowlist returns 503, not "allow everyone"; a real
JWKS-fetch failure (Clerk outage) also returns 503, distinct from a 401 for
an actually-invalid token. There is no per-auditor engagement-ownership
model yet — any authenticated auditor can see any engagement, matching the
current "single firm, all auditors see all engagements" product shape.
Resource-level consistency (a `stakeholder_id` belongs to the engagement
it's attached to, a file/request/engagement chain is internally coherent)
is enforced separately at each call site, since that's a data-integrity
property, not an identity one.

The public `/upload/[token]` flow never touches Clerk — its own upload POST
is gated by the request's own token instead (or a valid Clerk session, for
an auditor re-upload); see `_upload_credential_is_valid` in `main.py`.

## Postgres

Local DB `ai_audit_copilot`, 7 tables: `engagements`, `evidence_requests`,
`stakeholders`, `evidence_files`, `ai_reviews`, `activity_log`,
`review_decisions`. `seed.py` populates one engagement (`eng_001`) and one
evidence request (`req_seed_001`) for local testing.

## File storage

Evidence PDFs are uploaded straight into memory and sent to **Supabase
Storage** (a private bucket) — nothing is written to local disk. The
`evidence_files.path` column holds the Supabase object key (not a
filesystem path, despite the column name — repurposed rather than migrated,
since renaming it wasn't worth the risk for no behavior change).
`apps/api/uploads/` is a dead directory from before this migration; it's
still gitignored but nothing reads or writes it anymore.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`.env` (gitignored) needs **all** of the following — the app checks for
them at startup and refuses to boot (clear message, exit 1) if any are
missing:

```bash
DATABASE_URL=postgresql://<user>@127.0.0.1:5432/ai_audit_copilot
GROQ_API_KEY=...
RESEND_API_KEY=...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...          # service_role secret, not anon
SUPABASE_STORAGE_BUCKET=...            # a private bucket you've created

# optional, have defaults:
RESEND_FROM=onboarding@resend.dev
UPLOAD_BASE_URL=http://localhost:3000/upload
```

Auth needs three more vars, deliberately **not** in the startup-required list
above — see `app/auth.py`'s module docstring for why (a hard exit at import
time would make `/health` unreachable in any environment that hasn't set up
Clerk, including local dev/CI). Without them, every auditor-facing request
fails closed with a 503, so in practice these are required for anything past
`/health`:

```bash
CLERK_ISSUER=https://your-app.clerk.accounts.dev   # the Frontend API URL for your Clerk instance
# at least one of the next two, to define who counts as "an auditor":
CLERK_AUDITOR_ORG_ID=org_...        # Clerk Organization id for the firm's auditor team
CLERK_AUDITOR_USER_IDS=user_a,user_b # comma-separated Clerk user-id allowlist, if not using Organizations
```

Seed the DB (this script doesn't load `.env` itself):

```bash
export $(grep -v '^#' .env | xargs)
python seed.py
```

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

## Known constraints

- **Groq free tier**: materially higher than Gemini's 20/day (which is why
  the review pipeline moved off it), but still a real ceiling — there's no
  retry/backoff or paid-tier fallback yet.
- **N+1 queries** in `list_requests_for_engagement` (one query per request
  for files/AI review) — fine at the current scale of a handful of requests
  per engagement, revisit with a real join if that stops being true.

## Two rules worth locking in early

1. **Every state change goes through a single activity-log writer.**
   `main.py`'s `log_activity` is the only thing that inserts into
   `activity_log`, called from upload, analyze, and decision — this used to
   be an empty table with nothing writing to it; it isn't anymore.
2. **`ai_reviews` rows are immutable suggestions.** Auditor decisions live in
   `review_decisions`, never overwriting an AI output — defensibility
   depends on being able to show what the model said and what the auditor
   did about it.
