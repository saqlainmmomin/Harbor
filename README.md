# AI Audit Copilot

AI-assisted workflow for scoping, requesting, tracking, and reviewing audit
evidence against ISO 27001, NIST CSF, or PCI-DSS (SOC 2 support was dropped
in favor of these three). An auditor answers a handful of scope questions
for an engagement and gets back a computed, control-mapped evidence
checklist; that checklist becomes a draft RFI (request-for-information)
item list, which the auditor turns into real evidence requests sent to
stakeholders via magic link. A stakeholder uploads a PDF; the auditor then
explicitly triggers a control-aware AI review (Groq) of that one file
against the specific control its request is for — a real verdict
(met/partial/not met) with a quoted excerpt and concrete next evidence to
collect, not a generic document summary — and sees it in a real operational
dashboard alongside decision and activity history.

> **2026-09-03 backend work** (scope engine, RFI generation, control-aware
> analysis) is done, committed, and verified end-to-end against a live
> server with real Groq/Supabase calls — see
> [`tasks/handoffs/2026-09-03-backend-scope-rfi-analysis.md`](tasks/handoffs/2026-09-03-backend-scope-rfi-analysis.md)
> for the full API contract and real curl verification output. The
> matching frontend (scope UI, RFI review screen, review-panel "Analyze"
> button) is being built in a separate session against that contract —
> see [`tasks/handoffs/2026-09-03-frontend-scope-rfi-analysis.md`](tasks/handoffs/2026-09-03-frontend-scope-rfi-analysis.md).
> The plan behind both: [`docs/audit-evidence-workflow-brief.md`](docs/audit-evidence-workflow-brief.md).

## Architecture

```
ai_audit_copilot/
├── apps/
│   ├── web/                     # Next.js 16 + React 19 + Tailwind v4
│   │   └── src/
│   │       ├── proxy.ts                     # Clerk session init (Next 16 renamed middleware.ts → proxy.ts)
│   │       ├── app/
│   │       │   ├── (auth)/                  # route group: ClerkProvider-wrapped, auth-required
│   │       │   │   ├── layout.tsx           #   ClerkProvider
│   │       │   │   ├── engagements/[engagementId]/
│   │       │   │   │   ├── layout.tsx       #   auth() check + AppShell (sidebar/topbar/real user identity)
│   │       │   │   │   ├── page.tsx         #   Overview — summary cards, needs-attention, activity feed
│   │       │   │   │   ├── evidence/page.tsx        #   flattened real evidence-files list
│   │       │   │   │   ├── requests/page.tsx        #   full filterable requests table
│   │       │   │   │   └── requests/[requestId]/page.tsx  # review panel — AI analysis + real file preview
│   │       │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │       │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │       │   ├── upload/[token]/page.tsx  # PUBLIC — magic-link only, zero Clerk involvement
│   │       │   ├── layout.tsx               # true root layout — no ClerkProvider here
│   │       │   └── page.tsx                 # public landing page — zero Clerk, not in the proxy matcher
│   │       ├── components/
│   │       │   ├── app-shell.tsx, topbar.tsx, sidebar-nav.tsx  # persistent app chrome
│   │       │   ├── dashboard/    # overview-dashboard.tsx, requests-table.tsx
│   │       │   ├── evidence/     # evidence-files-table.tsx
│   │       │   └── review/       # review-panel.tsx (AI analysis + decision + activity)
│   │       └── lib/
│   │           ├── types.ts     # mirrors the Postgres schema
│   │           ├── api.ts       # calls the real FastAPI backend
│   │           ├── request-status.ts  # shared counts/urgency logic (Overview + Requests agree by construction)
│   │           ├── config.ts    # DEFAULT_ENGAGEMENT_ID (single-engagement prototype)
│   │           ├── mock-data.ts # legacy fabricated demo dataset — see "Known gaps" below
│   │           └── format.ts    # date/label helpers
│   └── api/                     # FastAPI (not yet deployed), see apps/api/README.md
│       ├── app/
│       │   ├── main.py              # engagements, magic-link send, upload, scope/RFI/analyze endpoints, activity log
│       │   ├── upload_lookup.py     # token/id → request/stakeholder/auditor resolution
│       │   ├── frameworks/          # ISO 27001 / NIST CSF / PCI-DSS control + scope-question definitions
│       │   └── services/
│       │       └── scope_profiler.py  # scope-answer → excluded controls + evidence checklist
│       ├── seed.py              # local test data
│       └── tests/                # smoke tests
└── README.md
```

Two apps, no shared package yet. Add `packages/shared-types` only when the
API contract stabilizes — until then generate TS types from FastAPI's
OpenAPI schema.

## Current state — what's built vs. not

**Built and wired to real infrastructure:**

- **Postgres** (local): `engagements`, `evidence_requests`, `stakeholders`,
  `evidence_files`, `ai_reviews`, `activity_log`.
- **Application shell**: persistent sidebar (Overview/Evidence/Requests real;
  Controls/Findings/Workpapers/Reports/Integrations/Settings marked "soon" —
  no fake entities behind them) with real active-route highlighting, a
  topbar with the real engagement name/period, a working search box, and
  the real signed-in user's name/email via Clerk's `<UserButton>` — this
  used to be a hardcoded "A. Rao" regardless of who was actually logged in.
- **Overview dashboard**: real summary cards (pending/overdue/needs
  review/potential exceptions), a "needs your attention" queue, three real
  engagement-progress percentages, and a real recent-activity feed.
- **Evidence and Requests pages**: real, separately, from the same
  Postgres-backed data — no fabricated rows mixed in anywhere.
- **Auth (Clerk)**: every route under `/engagements` requires a signed-in
  auditor (checked via `auth()` in the engagements layout, not middleware
  path-matching — see comments in `src/proxy.ts` for why). `/upload/[token]`
  and the public landing page (`/`) stay completely outside Clerk —
  stakeholders and anonymous visitors never touch it.
- **Scope engine**: an auditor answers a framework's scope questions
  (`GET /frameworks/{id}/scope-questions`, `POST/GET /engagements/{id}/scope`)
  and gets back applicable controls, excluded controls (with a reason, e.g.
  "no cloud usage" excluding cloud-specific ISO controls), and a control-
  mapped evidence checklist — real rule tables per framework in
  `app/services/scope_profiler.py`, not a static list.
- **RFI generation + bulk create**: the evidence checklist becomes a draft
  RFI item list (`POST /engagements/{id}/generate-rfi`, review/edit-only,
  writes nothing), which the auditor turns into real `evidence_requests`
  rows in one call (`POST /engagements/{id}/evidence-requests/bulk`),
  sharing the same insert/activity-log logic as the original single-item
  create endpoint.
- **Evidence upload, decoupled from AI review**: PDF upload extracts text
  (`pypdf`) and stores it, but no longer triggers AI review automatically —
  that used to happen inline on every upload regardless of whether the
  auditor was ready to look at it. The auditor now explicitly triggers a
  **control-aware analysis** (`POST /evidence-files/{file_id}/analyze`) of
  one file against the specific control its request is for (looked up from
  the ported ISO 27001/NIST CSF/PCI-DSS control library, with a graceful
  generic fallback if the request's `control_ref` doesn't match a known
  control), returning `compliance_status`, `current_state`,
  `gap_description`, `evidence_quote`, `risk_level`, and
  `follow_up_evidence` (a concrete next document to collect, not "provide
  more documentation"). Wired to a real submit button on the stakeholder
  upload form (sequential per-file, with honest partial-failure states) —
  it used to be a `setTimeout` stub that never called the backend at all.
- **Real document preview**: the review panel renders the actual PDF via a
  short-lived Supabase signed URL (`GET /evidence-files/{id}/preview-url`)
  — there used to be no way to see a file's content anywhere in the app.
- **Real activity log**: `activity_log` now actually gets written to (file
  uploaded, AI analysis completed) and read back on both the Overview
  dashboard and each request's detail page — it existed as an empty table
  before this.
- **File storage**: evidence files go to **Supabase Storage** (private
  bucket), not local disk — survives a redeploy, not tied to one host.
- **Startup config validation**: the API refuses to start (clear stderr
  message, exit 1) if `DATABASE_URL`, `GROQ_API_KEY`, `RESEND_API_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_STORAGE_BUCKET`
  is missing, instead of surfacing it later as an opaque 500.
- **CORS**: configured (`FRONTEND_ORIGIN`) — the stakeholder upload form is
  the one place the browser calls the FastAPI backend directly; every other
  frontend call is server-side and isn't subject to CORS, so this went
  undiscovered until an actual browser submitted a real file.
- **Magic-link evidence request emails** send via Resend.

**Known gaps — real, not hidden:**

- **Frontend not yet wired to the scope/RFI/analyze endpoints above** — the
  backend is done and verified via curl, but there's no scope UI, RFI
  review screen, or review-panel "Analyze" button in `apps/web` yet
  (in progress in a separate session — see the note at the top of this
  file). Until that lands, those endpoints are only reachable via direct
  API calls.
- **Controls, Findings, Workpapers, Reports, Integrations, Settings** exist
  only as disabled sidebar entries ("soon"). None of these have a data
  model, a backend, or even mock data behind them — deliberately, since
  faking them would reintroduce exactly the kind of fabricated content this
  project spent real effort removing. Building any of them for real needs a
  new schema + endpoints first.
- **Single engagement, no switcher**: there's no `GET /engagements` list
  endpoint and only one engagement exists in the database, so the sidebar's
  "organization" display shows that one real engagement rather than a
  switchable list. Not multi-tenant.
- `review_decisions` doesn't exist as a table yet, so `EvidenceRequest.decision`
  is always `null` when it comes from the real API. Auditor approve/reject
  decisions aren't persisted anywhere on the backend yet — clicking Approve
  in the review panel is still a prototype no-op.
- **The review panel** (`/engagements/[id]/requests/[requestId]`) still has
  a mock-data fallback for demo IDs (`req_014`, `req_007`, etc.) that aren't
  in Postgres — dead in normal navigation since nothing in the real UI links
  to a mock ID anymore, but still reachable if someone types one of those
  URLs directly. `apps/web/src/lib/mock-data.ts` and `apps/web/src/lib/upload-link.ts`'s
  `resolveMagicLink`/`MAGIC_LINKS` are the source of this; the latter's
  runtime logic is fully dead code today (only its `AuditorContact` type is
  still imported anywhere).
- **Groq free tier** is materially higher than Gemini's 20/day cap (the
  reason the review pipeline moved off Gemini), but still finite — there's
  no retry/backoff or paid-tier fallback.
- **Clerk dev instance**: a browser's very first, cookie-less visit to a
  Clerk-covered route can take a few extra seconds (or, rarely, fail
  outright with `ERR_TOO_MANY_REDIRECTS`) due to Clerk's own dev-mode
  "handshake" cookie retry behavior — confirmed independent of our code (a
  `SameSite=None` cookie missing `Secure`, rejected by the browser).
  Doesn't affect any returning/already-authenticated visit, and doesn't
  touch the public landing page or `/upload/[token]` at all (neither is in
  the Clerk proxy matcher). Production Clerk instances run over HTTPS,
  which should sidestep this entirely.
- **Clerk dev keys**: currently a claimed-but-still-development Clerk
  instance. Needs a production instance + domain before shipping — see
  "Before going to production" below.
- `npm audit` has 3 remaining high-severity findings in transitive
  dev-tooling deps (`postcss`/`sharp`, bundled inside `next`) that only
  resolve via `npm audit fix --force`, which bumps Next.js itself outside
  its currently pinned range — not done automatically.
- The stakeholder upload form's "note" field isn't persisted anywhere — the
  backend has no field for it yet.

## Setup

### 1. Backend (`apps/api`)

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `apps/api/.env` (gitignored):

```bash
DATABASE_URL=postgresql://<user>@127.0.0.1:5432/ai_audit_copilot
GROQ_API_KEY=...
RESEND_API_KEY=...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...          # service_role, not anon — server-side only
SUPABASE_STORAGE_BUCKET=...            # a private bucket you've created

# optional, have sensible defaults:
RESEND_FROM=onboarding@resend.dev
UPLOAD_BASE_URL=http://localhost:3000/upload
FRONTEND_ORIGIN=http://localhost:3000  # CORS — the browser calls this API directly from the upload form
```

All six required vars above are checked at startup — if any is missing,
`uvicorn` prints exactly which ones and exits immediately rather than
failing later on the first request that needs them.

Requires a local Postgres database named `ai_audit_copilot`. Seed it:

```bash
# seed.py doesn't load .env itself — export DATABASE_URL into the shell first:
export $(grep -v '^#' .env | xargs)
python seed.py
```

Run it:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (`apps/web`)

```bash
cd apps/web
npm install
```

Create `apps/web/.env.local` (gitignored):

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# Points straight at the dashboard, not "/" -- "/" is a public landing page
# with no auth check at all, so redirecting there after sign-in would just
# show the marketing page again with no visible sign anything happened.
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/engagements/eng_001
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/engagements/eng_001

# optional:
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000   # defaults to this
NEXT_PUBLIC_DEFAULT_ENGAGEMENT_ID=eng_001        # defaults to this
```

Get Clerk keys from [clerk.com](https://clerk.com) (a free account works
for development), or run `npx clerk@latest init` from `apps/web` for a
zero-signup "keyless" dev instance you can claim later with
`npx clerk@latest auth login`.

Run it:

```bash
npm run dev      # http://localhost:3000
```

### Verifying it's all working

```bash
curl http://localhost:8000/health                    # {"status":"ok"}
curl http://localhost:8000/engagements/eng_001        # real seeded engagement
open http://localhost:3000                            # public landing page, no auth
```
Click "Sign in" on the landing page to reach the real dashboard.

## Before going to production

- Swap Clerk dev keys for a production instance + your real domain.
- Move off the local Postgres instance to a managed one.
- Watch Groq's free-tier ceiling under real usage — no retry/backoff or
  paid-tier fallback exists yet if it's hit.
- Read [SECURITY.md](SECURITY.md) for current data-handling practices —
  in particular, there's no retention policy and no TLS enforcement on the
  database connection yet.
