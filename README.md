# AI Audit Copilot

AI-assisted workflow for requesting, tracking, and reviewing SOC 2 audit
evidence. An auditor sends a stakeholder a magic link; the stakeholder
uploads a PDF; the backend extracts its text, sends it to Gemini for a
structured compliance review, and the auditor sees the result (with a
code-based placeholder-detection floor under the model's judgment) on a
real-time dashboard.

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
│   │       │   │   │   ├── layout.tsx       #   auth() check — redirects to /sign-in if signed out
│   │       │   │   │   ├── page.tsx         #   evidence dashboard (real Postgres data)
│   │       │   │   │   └── requests/[requestId]/page.tsx  # AI review panel
│   │       │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │       │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │       │   ├── upload/[token]/page.tsx  # PUBLIC — magic-link only, zero Clerk involvement
│   │       │   ├── layout.tsx               # true root layout — no ClerkProvider here
│   │       │   └── page.tsx                 # auth()-aware redirect: signed in → dashboard, else → /sign-in
│   │       ├── components/      # presentational + interactive UI
│   │       └── lib/
│   │           ├── types.ts     # mirrors the Postgres schema
│   │           ├── api.ts       # calls the real FastAPI backend
│   │           ├── config.ts    # DEFAULT_ENGAGEMENT_ID (single-engagement prototype)
│   │           ├── mock-data.ts # legacy fabricated demo dataset — see "Known gaps" below
│   │           └── format.ts    # date/label helpers
│   └── api/                     # FastAPI (not yet deployed), see apps/api/README.md
│       ├── app/
│       │   ├── main.py          # engagement lookup, magic-link send, PDF upload + AI review
│       │   └── upload_lookup.py # token/id → request/stakeholder/auditor resolution
│       ├── seed.py              # local test data
│       └── tests/               # smoke tests
└── README.md
```

Two apps, no shared package yet. Add `packages/shared-types` only when the
API contract stabilizes — until then generate TS types from FastAPI's
OpenAPI schema.

## Current state — what's built vs. not

**Built and wired to real infrastructure:**

- **Postgres** (local): `engagements`, `evidence_requests`, `stakeholders`,
  `evidence_files`, `ai_reviews`, `activity_log`.
- **Evidence dashboard** (`/engagements/[id]`) renders only real
  `evidence_requests` rows for the engagement — no fabricated data mixed in.
- **Auth (Clerk)**: every route under `/engagements` requires a signed-in
  auditor (checked via `auth()` in the engagements layout, not middleware
  path-matching — see comments in `src/proxy.ts` for why). `/upload/[token]`
  stays completely outside Clerk — stakeholders never see it, never get a
  Clerk session.
- **Evidence upload → AI review pipeline**: PDF upload extracts text
  (`pypdf`), sends it to Gemini (`gemini-flash-latest`) for a structured
  review (`document_type`, `summary`, `suggested_controls`,
  `missing_sections`, `completeness_label`), with a code-based floor that
  caps `completeness_label` at `partial` if the document still has unfilled
  `[template placeholders]` — deliberately not left to the model's judgment.
- **File storage**: evidence files go to **Supabase Storage** (private
  bucket), not local disk — survives a redeploy, not tied to one host.
- **Startup config validation**: the API refuses to start (clear stderr
  message, exit 1) if `DATABASE_URL`, `GEMINI_API_KEY`, `RESEND_API_KEY`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_STORAGE_BUCKET`
  is missing, instead of surfacing it later as an opaque 500.
- **Magic-link evidence request emails** send via Resend.
- `apps/web/src/lib/api.ts` calls the real API for the upload-link page and
  the dashboard — both render real DB data end to end.

**Known gaps — real, not hidden:**

- `review_decisions` doesn't exist as a table yet, so `EvidenceRequest.decision`
  is always `null` when it comes from the real API. Auditor approve/reject
  decisions aren't persisted anywhere on the backend yet.
- No endpoint serves the original uploaded PDF back to the browser — files
  land in Supabase Storage but there's no "view/download" affordance in the
  UI yet.
- `activity_log` exists as a table but nothing writes to it.
- **The review panel** (`/engagements/[id]/requests/[requestId]`) still has
  a mock-data fallback for demo IDs (`req_014`, `req_007`, etc.) that aren't
  in Postgres — dead in normal navigation since the dashboard only ever
  links to real IDs now, but still reachable if someone types one of those
  URLs directly. `apps/web/src/lib/mock-data.ts` and `apps/web/src/lib/upload-link.ts`'s
  `resolveMagicLink`/`MAGIC_LINKS` are the source of this; the latter's
  runtime logic is fully dead code today (only its `AuditorContact` type is
  still imported anywhere).
- **Gemini free tier** is capped at 20 requests/day — expect real 429s
  during testing; there's no retry/backoff or paid-tier fallback.
- **Clerk dev instance**: a browser's very first, cookie-less visit to any
  `/engagements` or `/sign-in` route can take a few extra seconds (or, in
  rarer cases, fail outright with `ERR_TOO_MANY_REDIRECTS`) due to Clerk's
  own dev-mode "handshake" cookie retry behavior — confirmed independent of
  our code (a `SameSite=None` cookie missing `Secure`, rejected by the
  browser). Doesn't affect any returning/already-authenticated visit.
  Production Clerk instances run over HTTPS, which should sidestep this
  entirely; worth re-testing once this app has a real deployment.
- **Clerk dev keys**: currently a claimed-but-still-development Clerk
  instance. Needs a production instance + domain before shipping — see
  "Before going to production" below.
- `npm audit` has 3 remaining high-severity findings in transitive
  dev-tooling deps (`postcss`/`sharp`, bundled inside `next`) that only
  resolve via `npm audit fix --force`, which bumps Next.js itself outside
  its currently pinned range — not done automatically.
- Nav items "Control checklist", "Stakeholders", "Activity log", "Report
  pack" are UI stubs (`app-shell.tsx`), not implemented.
- Single-engagement, single-auditor prototype — no engagement picker, no
  multi-tenant scoping.

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
GEMINI_API_KEY=...
RESEND_API_KEY=...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...          # service_role, not anon — server-side only
SUPABASE_STORAGE_BUCKET=...            # a private bucket you've created

# optional, have sensible defaults:
RESEND_FROM=onboarding@resend.dev
UPLOAD_BASE_URL=http://localhost:3000/upload
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
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

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
open http://localhost:3000                            # redirects to /sign-in if signed out
```

## Before going to production

- Swap Clerk dev keys for a production instance + your real domain.
- Move off the local Postgres instance to a managed one.
- Add the missing `review_decisions` table and wire up approve/reject
  persistence.
- Decide on Gemini paid tier (or a fallback model) before relying on the AI
  review pipeline for real usage.
- Add a way to view/download the original uploaded evidence file.
- A data-handling note (where evidence files live, retention, encryption,
  access) is coming next as `SECURITY.md`.
