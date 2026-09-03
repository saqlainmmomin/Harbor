# Data handling

An honest statement of current practice — not a compliance certification,
not SOC 2 itself (ironic, given what this app audits for). If you're
evaluating this for real audit evidence, read this before you rely on it.

## What data this app handles

- **Evidence files** — PDFs uploaded by stakeholders (policy documents,
  access reviews, logs, etc.). Potentially sensitive: personnel names,
  system configuration, access control details.
- **Extracted text** from those PDFs, sent to an AI model for review.
- **Contact info** — stakeholder and auditor names/emails.
- **Auditor account data** — handled entirely by Clerk (email, auth
  method); this app never sees or stores passwords.

## Where evidence files live

Uploaded PDFs are stored in **Supabase Storage**, in a **private** bucket
(not publicly readable — there is no public URL for any file). The bucket
name is set per-deployment via `SUPABASE_STORAGE_BUCKET`.

Access to the bucket is via the Supabase **service-role key**, held only in
the backend's `apps/api/.env` (gitignored, never sent to the browser). The
frontend never talks to Supabase directly.

**Auditors can now view the original file.** `GET /evidence-files/{id}/preview-url`
generates a short-lived (5-minute) Supabase signed URL and the review panel
renders it directly — this is new; earlier versions of this document said
nothing could read a file back out, which was true until this endpoint
existed. The signed URL is scoped to one file, expires quickly, and is only
ever handed to an already-authenticated auditor request; it's never stored
or logged anywhere. Stakeholders (the `/upload/[token]` flow) have no way to
request one — only the authenticated app does.

Files uploaded before this Supabase migration exist as local test data in
`apps/api/uploads/` (gitignored, not deployed anywhere) — legacy, not part
of the current storage path.

## Retention

**There is no retention policy.** Files are kept indefinitely; nothing
deletes them automatically, and there's no manual delete function in the
app either. The same is true of every database table — `evidence_requests`,
`evidence_files`, `ai_reviews`, and everything else persist forever unless
someone manually runs SQL against the database.

If this needs a real retention policy (e.g., delete evidence N days after
engagement close), that has to be built — it doesn't exist today.

## Encryption

**In transit:**
- Frontend ↔ backend: **not encrypted in local dev** (`http://localhost:8000`
  by default). A production deployment must run both behind HTTPS — this
  isn't configured anywhere in the app itself; it depends on how you deploy.
- Backend ↔ Supabase, Gemini, Resend, Clerk: all HTTPS (the SDKs used for
  each default to TLS endpoints; not something this app configures itself).
- Backend ↔ Postgres: **not enforced.** `DATABASE_URL` has no `sslmode` set,
  and libpq's default (`prefer`) silently falls back to plaintext if the
  server doesn't offer SSL — true for most default local Postgres installs,
  which is what this runs against today. A production Postgres provider
  should be configured with `sslmode=require` (or stronger) explicitly.

**At rest:**
- Supabase Storage and Postgres-as-a-service providers generally encrypt
  data at rest by default at the infrastructure level — but this app hasn't
  independently configured or verified that for this specific project; it's
  relying on the provider's platform default, not something audited here.
- The local Postgres instance used in development has no at-rest encryption
  configured at all (it's a plain local Postgres install).

## Who can access what, today

- **Evidence files**: whoever holds the Supabase project's service-role key
  (currently: whoever has `apps/api/.env`) or has dashboard access to the
  Supabase project itself, plus any signed-in auditor — the review panel can
  now request a 5-minute signed URL for a file and view it in place.
  Stakeholders (the magic-link upload flow) have no way to request one.
- **Database rows** (requests, reviews, stakeholder contact info): whoever
  can connect to the Postgres instance directly, plus any signed-in auditor
  through the API (there's no per-auditor row-level scoping yet — this is a
  single-engagement, single-auditor prototype, not multi-tenant).
- **The evidence dashboard and review panel**: any auditor with a valid
  Clerk session for this app. There's no role distinction (e.g., no
  "read-only" vs "lead auditor") yet.
- **The upload page** (`/upload/[token]`): anyone with the magic-link URL —
  by design, this is the stakeholder's only credential. **Tokens never
  expire.** The real backend's token lookup (`upload_lookup.py`) only ever
  returns "invalid" (no match) or "active" (match found) — there is no
  expiry check at all today, despite the frontend having UI for an
  "expired" state. A link is valid forever until someone manually clears
  the `token` column in the database.

## Third parties that see this data

- **Google Gemini** receives the extracted text of every uploaded document
  for AI review. This is the core feature, not incidental — if a document
  shouldn't leave your infrastructure, don't upload it through this app
  today.
- **Resend** receives stakeholder email addresses and the evidence-request
  magic link (not file content).
- **Supabase** stores the file bytes and (via its Postgres offering, if
  used in a given deployment) potentially the application database too.
- **Clerk** handles auditor authentication — sees auditor emails and
  session data, not evidence content.

## What this doesn't cover

No audit logging of who accessed what evidence file and when (`activity_log`
exists as a table but nothing writes to it — see root README). No
penetration testing has been done. No formal access review process. This
document describes what the code actually does today, not a target state.
