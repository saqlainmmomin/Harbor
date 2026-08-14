# AI Audit Copilot

AI-assisted workflow for requesting, tracking, and reviewing SOC 2 audit evidence.

## Monorepo layout

```
ai_audit_copilot/
├── apps/
│   ├── web/                     # Next.js 16 + React 19 + Tailwind v4 (Vercel)
│   │   └── src/
│   │       ├── app/             # App Router
│   │       │   ├── engagements/[engagementId]/                       # evidence dashboard
│   │       │   ├── engagements/[engagementId]/requests/[requestId]/  # AI review panel
│   │       │   └── upload/[token]/                                   # client-facing upload link
│   │       ├── components/      # presentational + interactive UI
│   │       └── lib/
│   │           ├── types.ts     # mirrors the Postgres schema (single source of truth for the UI)
│   │           ├── api.ts       # calls the real FastAPI backend (upload-token lookup)
│   │           ├── mock-data.ts # seeded fake data — dashboard/review panel still run on this
│   │           └── format.ts    # date/label helpers
│   └── api/                     # FastAPI (Railway/Render) — real backend, see apps/api/README.md
│       ├── app/
│       │   ├── main.py          # engagement lookup, magic-link send, PDF upload + AI review
│       │   └── upload_lookup.py # token → request/stakeholder/auditor resolution
│       ├── seed.py              # local test data
│       └── tests/                # smoke tests
└── README.md
```

Two apps, no shared package yet. Add `packages/shared-types` only when the API
contract stabilizes — until then generate TS types from FastAPI's OpenAPI schema.

## Current state

**Backend is real, frontend is partially wired to it.**

- **Postgres**: 6 tables live locally (`engagements`, `evidence_requests`,
  `stakeholders`, `evidence_files`, `ai_reviews`, `activity_log`).
- **Evidence upload → AI review pipeline works end to end**: PDF upload to
  the API extracts text (`pypdf`), sends it to OpenAI `gpt-4o-mini` for a
  structured compliance review (`document_type`, `summary`,
  `suggested_controls`, `missing_sections`, `completeness_label`), and
  persists the result to `ai_reviews`.
- **Magic-link evidence request emails** send via Resend.
- **`apps/web/src/lib/api.ts`** calls the real API for the upload-link page
  (`/upload/[token]`) — that screen renders real DB data end to end.
- **Evidence dashboard and AI review panel still run on `mock-data.ts`** —
  they were not yet repointed at the real API. `review_decisions` also
  doesn't exist as a table yet, so `EvidenceRequest.decision` is always
  `null` when it comes from the real API (see `apps/web/src/lib/api.ts`).
- No auth yet (Clerk was planned, not implemented).

## Run

```bash
# terminal 1 — backend
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend
cd apps/web
npm run dev      # http://localhost:3000
```

Requires a local Postgres database named `ai_audit_copilot` (see
`apps/api/seed.py` for test data) and `apps/api/.env` with `OPENAI_API_KEY`
and `RESEND_API_KEY` set.
