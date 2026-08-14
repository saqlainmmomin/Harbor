# AI Audit Copilot

AI-assisted workflow for requesting, tracking, and reviewing SOC 2 audit evidence.

## Monorepo layout

```
ai_audit_copilot/
├── apps/
│   ├── web/                     # Next.js 16 + React 19 + Tailwind v4 (Vercel)
│   │   └── src/
│   │       ├── app/             # App Router
│   │       │   ├── engagements/[engagementId]/          # evidence dashboard
│   │       │   └── engagements/[engagementId]/requests/[requestId]/   # AI review panel
│   │       ├── components/      # presentational + interactive UI
│   │       └── lib/
│   │           ├── types.ts     # mirrors the Postgres schema (single source of truth for the UI)
│   │           ├── mock-data.ts # seeded fake data — swap for API calls later
│   │           └── format.ts    # date/label helpers
│   └── api/                     # FastAPI (Railway/Render) — not built yet
│       ├── app/
│       │   ├── main.py
│       │   ├── api/v1/          # routers: engagements, requests, files, reviews, webhooks
│       │   ├── models/          # SQLAlchemy models (from your schema)
│       │   ├── schemas/         # Pydantic request/response
│       │   ├── services/        # ai_review, email, storage, escalation
│       │   └── workers/         # background jobs: extract→classify→summarize→map→flag
│       ├── alembic/             # migrations generated from your schema
│       └── pyproject.toml
├── docs/                        # schema.sql, decisions, control library seed
└── README.md
```

Two apps, no shared package yet. Add `packages/shared-types` only when the API
contract stabilizes — until then generate TS types from FastAPI's OpenAPI schema.

## Current state

Phase 0: **UI-only prototype.** No auth, no backend, no DB. Both screens run on
seeded data in `apps/web/src/lib/mock-data.ts` so the UX can be evaluated before
committing to plumbing.

## Run

```bash
cd apps/web
npm run dev      # http://localhost:3000
```
