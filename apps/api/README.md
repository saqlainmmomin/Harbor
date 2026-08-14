# apps/api — FastAPI backend

Real backend, running against a local Postgres database. Not yet deployed
(target: Railway/Render).

```
app/
  main.py               # FastAPI app; engagement lookup, magic-link send,
                         # PDF upload → AI review pipeline
  upload_lookup.py       # token → request/stakeholder/auditor resolution
                          # for the public /upload/[token] page
seed.py                  # local test data (1 engagement, 1 evidence request)
tests/                   # smoke tests
uploads/                 # uploaded PDFs land here (gitignored, local only)
```

## What's actually built

- `GET /health` — healthcheck
- `GET /engagements/{engagement_id}` — engagement lookup
- `GET /upload/{token}` — resolves a magic-link token to the evidence
  request/stakeholder/auditor, or `{"kind": "invalid"}` if the token doesn't
  match. (Note: doesn't yet distinguish an *expired* token from an *approved*
  one — the DB doesn't track those states here yet.)
- `POST /evidence-requests/{request_id}/send` — generates (or reuses) a
  magic-link token, emails it via Resend
- `POST /evidence-requests/{request_id}/upload` — accepts a PDF, saves it to
  `uploads/`, extracts text with `pypdf`, sends it to OpenAI `gpt-4o-mini`
  with a compliance-reviewer prompt, and persists the structured result
  (`document_type`, `summary`, `suggested_controls`, `missing_sections`,
  `completeness_label`) to the `ai_reviews` table
- `GET /evidence-requests/{request_id}/review` — latest uploaded file + its
  AI review for a request

## Postgres

Local DB `ai_audit_copilot`, 6 tables: `engagements`, `evidence_requests`,
`stakeholders`, `evidence_files`, `ai_reviews`, `activity_log`. `seed.py`
populates one engagement (`eng_001`) and one evidence request
(`req_seed_001`) for local testing.

`review_decisions` does **not** exist yet — auditor approve/reject/request-more
decisions aren't persisted anywhere on the backend yet. The frontend's
`EvidenceRequest.decision` field is always `null` when populated from the
real API as a result.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`.env` (gitignored) needs:
```
OPENAI_API_KEY=...
RESEND_API_KEY=...
DATABASE_URL=postgresql://<user>@127.0.0.1:5432/ai_audit_copilot   # optional, this is the default
```

```bash
uvicorn app.main:app --reload --port 8000
```

## Two rules worth locking in early

1. **Every state change should go through a single activity-log writer.**
   `activity_log` exists as a table but nothing writes to it yet — this is
   still a TODO, not implemented.
2. **`ai_reviews` rows are immutable suggestions.** Once `review_decisions`
   exists, auditor decisions should live there, never overwriting an AI
   output — defensibility depends on being able to show what the model said
   and what the auditor did about it.
