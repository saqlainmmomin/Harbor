# Scope/RFI workflow fixes — implementation handoff

## Goal

Implement the fixes identified in `/Users/saqlainmomin/ai_audit_copilot/tasks/handoffs/2026-09-03-codex-review-scope-rfi.md` so the framework-aware workflow is safe and coherent end to end:

`scope selection → required scope answers → computed checklist → RFI draft → bulk evidence requests → upload/extraction → control-aware analysis → review/evidence display`.

The work is complete when the new auditor-facing APIs enforce authentication and engagement ownership, scope rules point at the correct controls, unresolved input and AI failures cannot silently mutate state, the frontend handles races and failures, persisted analysis fields are returned and rendered, and focused backend/frontend tests plus a combined smoke test pass.

Do not only write a report. Modify the code and tests, then record the implementation decisions, changed files, verification output, and any remaining blockers in the `## Results` section at the end of this file.

## Current state

- Repository: `/Users/saqlainmomin/ai_audit_copilot`.
- The current checkout is `main` at `02475be`. Backend scope/RFI/analyze work is present through `1138b05`/`7fbd02d`.
- The frontend work is on branch `frontend/scope-rfi-ui` at `84e4858`, based on the older `db836c3`, not on the current backend head. Inspect the actual branches and integrate the frontend changes safely into the working tree before validating the combined flow. Do not reset or discard work to do this.
- The prior review is authoritative for the detailed evidence and contains its own results: `/Users/saqlainmomin/ai_audit_copilot/tasks/handoffs/2026-09-03-codex-review-scope-rfi.md`.
- Existing unrelated working-tree changes must be preserved:
  - `tasks/handoffs/2026-09-03-codex-review-scope-rfi.md`
  - `tasks/handoffs/2026-09-03-codex-seed-gap-documents.md`
  - `tasks/handoffs/2026-09-03-frontend-scope-rfi-analysis.md`
  - `apps/api/tests/fixtures/`
- The visible backend test suite currently cannot be assumed runnable in the default environment: an earlier collection attempt failed because `psycopg` was unavailable. Use the project’s intended environment/dependencies and report the exact limitation if setup is impossible.

## Read first

Read the review above in full, then inspect the applicable repository instructions before editing:

- `/Users/saqlainmomin/ai_audit_copilot/AGENTS.md`
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/AGENTS.md` if present
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/AGENTS.md`
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/CLAUDE.md` if present
- The original implementation context:
  - `/Users/saqlainmomin/ai_audit_copilot/tasks/handoffs/2026-09-03-backend-scope-rfi-analysis.md`
  - `/Users/saqlainmomin/ai_audit_copilot/tasks/handoffs/2026-09-03-frontend-scope-rfi-analysis.md`

## Key files

Backend:

- `/Users/saqlainmomin/ai_audit_copilot/apps/api/app/main.py` — scope, RFI generation, bulk evidence-request creation, upload, and analyze routes; currently contains the largest correctness/security surface.
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/app/services/scope_profiler.py` — framework-specific scope questions, exclusion rules, and checklist generation.
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/app/frameworks/definitions/iso27001.py` — ISO control definitions and scope-question context.
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/app/frameworks/definitions/nist_csf.py` — authoritative NIST control IDs.
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/app/frameworks/definitions/pci_dss.py` — authoritative PCI control IDs.
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/seed.py` — seeded engagement/framework/stakeholder data, including legacy SOC2 and stakeholders without `engagement_id`.
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/app/upload_lookup.py` — existing review/evidence lookup responses and duplicate AI-review schema handling.
- `/Users/saqlainmomin/ai_audit_copilot/apps/api/tests/` — existing API test conventions and fixtures; add focused coverage here.

Frontend:

- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/components/scope/scope-workflow.tsx` — framework selection, question loading, answer validation, scope submission, RFI transition, and async navigation state.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/lib/api.ts` — API calls, response parsing, error behavior, and the current raw analyze fallback.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/lib/types.ts` — framework, scope, RFI, and analysis types.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/components/engagements/new-engagement-form.tsx` — framework defaults/options; currently defaults to SOC2 while the backend allow-list excludes it.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/components/review/review-panel.tsx` — control-aware review rendering and model/status display.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/components/evidence/badges.tsx` — evidence/review status consumers.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/app/(auth)/engagements/[engagementId]/scope/page.tsx` — route entry point for the workflow.

## Constraints and decisions

- Never add credentials, tokens, private URLs, or copied environment values to source, tests, handoff output, or git history. Use mocks for AI/storage in automated tests.
- Preserve the unrelated dirty files listed above. Do not use `git reset --hard`, `git checkout --`, broad deletion, or an overwrite that could erase another session’s changes. Do not commit, push, or open a PR unless separately requested.
- Keep the existing public stakeholder/magic-link upload behavior intentional. It must not become an accidental bypass for auditor-facing engagement, scope, RFI, or analysis routes. Separate token-scoped public access from authenticated auditor access.
- Use the project’s existing conventions and the smallest coherent change. Avoid a broad refactor of `main.py` unless needed for a shared auth/transaction/validation helper. Centralize duplicate schema/validation logic where that reduces drift.
- Make the following product decisions explicitly in code/comments or documentation and record them in Results:
  1. Framework compatibility: either preserve SOC2 as a supported/deprecated compatibility value during migration, or atomically migrate the form, types, seed data, database constraint, and existing rows to ISO27001/NIST_CSF/PCI_DSS. The current seed and form use SOC2 while `VALID_FRAMEWORKS` and the schema constraint exclude it; the normal seeded flow must not fail or silently diverge.
  2. Authentication: inspect the existing Clerk/browser auth integration and establish one verifiable token-to-FastAPI boundary. Add reusable backend authentication and engagement ownership dependencies/checks. Do not accept a caller-supplied engagement ID as proof of access. If a local environment cannot exercise the identity provider, test valid/invalid claims with deterministic mocks.
  3. ISO remote semantics: a fully remote organization still has remote laptops and other off-premises assets. Narrow the remote exclusion to controls genuinely about physical premises; do not blanket-exclude all ISO A7 controls, especially off-premises asset, media, maintenance, or disposal controls when applicable.
- The analyzer’s control-aware path is based on one concrete control ID per request. Keep that contract consistent unless the API and prompt model are deliberately redesigned together.
- If the repo’s prescribed plan workflow applies, use `tasks/todo.md`; do not use it as a reason to defer implementation.

## Implementation scope

Work in this order, rechecking the combined branch after each group.

### 1. Protect data and make ownership explicit (P0)

- Add authentication to the new browser-facing scope, generate-RFI, bulk-request, upload/analyze, and review/list paths as appropriate. Follow the existing auth architecture rather than inventing a second identity mechanism.
- Enforce engagement ownership on every changed lookup. In particular, bulk RFI creation must verify each `stakeholder_id` belongs to the target engagement, not just that the stakeholder exists globally. Prevent cross-engagement reads, inserts, uploads, and analyses.
- Keep any public upload endpoint limited to its existing token-scoped purpose, with no access to auditor data by ID alone.
- Add unauthorized, invalid-claim, cross-engagement, and happy-path tests.

### 2. Align framework and database contracts (P1)

- Resolve the SOC2 mismatch across backend validation, schema constraints/migrations, seed data, frontend defaults/options, and types. Existing rows must not make request-time DDL fail.
- Repair legacy stakeholder data so seeded/legacy stakeholders have the engagement relationship required by scope/RFI selection. Use a safe migration/backfill based on existing request relationships or explicit seed migration.
- Make the persisted selected framework set the single source of truth. Scope submission and analyzer control lookup must agree; selecting ISO/NIST/PCI must not silently fall back to a generic review because only `engagement_frameworks` was consulted.
- Avoid destructive per-request table rebuilds. Make schema changes idempotent and safe for existing data.

### 3. Correct scope computation and checklist generation (P1)

- Treat missing/unanswered scope questions as unresolved. In particular, a blank PCI channel answer must not automatically exclude `PCI.6.6`; require an answer or reject/mark the scope incomplete.
- Correct every NIST `maps_to` reference in `scope_profiler.py` against the actual IDs in `nist_csf.py`. Several entries describe ID/PR/DE/RS/RC/GV.SC families but point at unrelated `NIST.GV.*` IDs. Add a test that every referenced control ID exists and that representative mappings match the named family.
- Narrow the ISO fully-remote rule as described above. Review each affected A7 exclusion against the control definition, not just the control prefix.
- Validate framework IDs, question IDs, answer shapes, answer choices, and checklist IDs at the API boundary. Invalid or incomplete input must not persist a misleading computed checklist.

### 4. Make RFI and analysis behavior safe (P1)

- Generate one RFI/request per concrete target control, or change the analyzer contract to support multiple controls end to end. Do not store comma-separated control IDs in a field later matched by exact equality.
- Treat `control_ref` as untrusted input. Validate it against known framework control IDs and delimit it in prompts; never interpolate raw user text into system instructions. Unknown references should be rejected or take a clearly isolated generic path without altering the system prompt.
- If extracted evidence is blank, do not call Groq, persist a fake review, or transition the request to a successful reviewed state. Return a typed not-assessed/validation response appropriate to the existing API contract.
- Validate AI output as a complete object with required fields and field types/enums before persistence. Handle syntax errors, JSON arrays, missing fields, invalid statuses, and unexpected values without a 500 or partial review row. Keep database status/review writes atomic and return an explicit upstream/validation error.
- Make bulk creation all-or-nothing: validate every item before inserting, roll back on any failure, and define idempotent retry behavior (idempotency key or a documented uniqueness policy).
- Extract/validate PDFs before storage upload, or delete the uploaded object when extraction fails, so failures do not leave orphaned storage objects.
- Add an explicit client timeout for the AI request if the current HTTP client supports it.

### 5. Repair frontend async and display contracts (P1/P2)

- Snapshot the selected frameworks when loading scope questions and submitting scope. Disable selection while loading or use an operation token/cancellation guard so stale results cannot move the UI to a different or incomplete step.
- Make `fetchScopeQuestions` and `generateRfiDraft` return typed failures (or throw typed errors) instead of converting network/JSON/dependency failures to `[]`. If any selected framework fails to load, keep the user on the framework/questions step and show an actionable error; never proceed with partial questions.
- Validate required scope answers in the UI and enforce the same rule on the backend. Do not enable submission with blank answers that change inclusion/exclusion semantics.
- Prevent Back or other navigation from allowing a late scope POST to force the user into the checklist step. Disable navigation while pending or guard completion with an operation token.
- Update frontend types and consumers to use the persisted `compliance_status`, `follow_up_evidence`, and `raw_response` contract returned by review/list endpoints. Remove the unchecked `raw_response.text` fallback once the structured contract is reliable; retain backward compatibility only if it is validated and demonstrably needed.
- Verify all review/evidence cards render the structured control-aware result, including the correct model/status fields and non-reviewed/not-assessed states.

### 6. Add regression coverage (required)

Use the project’s test stack and mocking conventions. At minimum cover:

- auth and engagement/stakeholder ownership, including cross-engagement bulk requests;
- framework compatibility/migration and legacy stakeholder visibility;
- scope persistence/GET, missing answers, each framework’s representative exclusions, all checklist reference existence, corrected NIST mappings, and remote ISO behavior;
- scope question loading failure, partial results, selection changes during loading, late submit completion, and Back while pending;
- one-control-per-RFI mapping and duplicate/idempotent bulk retry behavior;
- empty evidence, malformed/non-object/invalid AI JSON, unknown control refs, no side effects on failure, and review/list response fields;
- PDF extraction failure cleanup;
- frontend generation/API failure and structured review rendering.

If the existing integration tests require external Postgres, storage, or AI services, isolate those boundaries with fixtures/mocks and add a deterministic unit/API layer that still proves transaction and validation behavior.

## Verification

Run and report the exact commands and outcomes:

1. `git diff --check` and a review of `git status` confirming unrelated changes remain intact.
2. Backend formatting/lint/type checks prescribed by the repo, then the API tests (normally from `apps/api`; install/use the project environment if available).
3. Frontend lint/typecheck/build/test commands from `apps/web/package.json` and its instructions.
4. Static assertions that every scope checklist `maps_to` ID exists in the framework definitions and that no unresolved answer is treated as an exclusion.
5. A combined smoke test on one integrated tree: authenticate as an authorized auditor, select at least two frameworks, answer all required questions, inspect computed exclusions and control IDs, generate RFIs, create them in bulk, upload a PDF, analyze valid evidence, reload the review/evidence list, and exercise blank evidence, malformed AI output, unauthorized access, and cross-engagement access. Use deterministic mocks where live services are unavailable.
6. Re-run the focused tests after any integration/rebase adjustment. If a check cannot run, state why, what was still verified, and the smallest next step.

## Results

**Status: all P0/P1 items implemented and tested; P2 items (idempotency, structured-field return) also done. Frontend branch integrated into the working tree via a clean patch apply (no conflicts — main and `frontend/scope-rfi-ui` never touched the same files). Backend: 34/34 tests pass against a real local Postgres. Frontend: `tsc --noEmit`, `next build`, and `eslint` all clean except one pre-existing, out-of-scope warning.**

### Branch integration

`frontend/scope-rfi-ui` (84e4858) is based on `db836c3`; current `main` (02475be) is `db836c3` + backend-only commits (`7fbd02d`, `1138b05`) that never touched `apps/web`. Confirmed via `git diff --stat db836c3 02475be -- apps/web` (empty). Generated `git diff db836c3 84e4858 -- apps/web`, confirmed a clean `git apply --check`, and applied it directly — no cherry-pick/merge/reset needed, no conflicts, nothing discarded. `tasks/handoffs/2026-09-03-frontend-scope-rfi-analysis.md` was excluded from the integration since your working tree's dirty copy already carried the frontend session's `## Results` (preserved untouched, as instructed).

### The three required product decisions

1. **Framework compatibility (SOC2 → ISO27001/NIST_CSF/PCI_DSS): atomic migration, no compatibility window.** SOC2 was already fully dropped from the backend's `VALID_FRAMEWORKS` before this session; the only remaining mismatch was `apps/api/seed.py` (`engagements.framework = 'SOC2'`) and `apps/web/src/components/engagements/new-engagement-form.tsx` (defaulted to `SOC2`, offered it as a real option) — both switched to `ISO27001`. `apps/web/src/lib/types.ts`'s `Framework` type changed from `"SOC2" | "ISO27001"` to `"ISO27001" | "NIST_CSF" | "PCI_DSS"` (matching the backend exactly; `NIST_CSF`/`PCI_DSS` were previously mislabeled "Coming soon" in the engagement-creation form even though the backend has fully supported them since the original backend session — promoted to real, selectable options). `apps/api/app/main.py`'s `ensure_engagement_schema` now deletes any legacy `engagement_frameworks` row with an unsupported `framework` value *before* re-adding the `CHECK` constraint, so a database that predates this change (when `VALID_FRAMEWORKS` was `{SOC2, ISO27001}`) can't fail the `ALTER TABLE ... ADD CONSTRAINT` on every single request. `seed.py`'s stale `evidence_requests.control_ref = "CC6.2"` (a SOC2 control id) was left as-is — the analyze endpoint's unmatched-control fallback already handles it gracefully, and rewriting seeded evidence-request content was out of scope.

2. **Authentication: one Clerk-JWT-to-FastAPI boundary; no per-auditor engagement ownership model (matches the app's existing single-firm design).** New `apps/api/app/auth.py`: `get_current_auditor_id` is a FastAPI dependency that verifies the `Authorization: Bearer <token>` header as a Clerk session JWT via RS256 + JWKS (fetched from `{CLERK_ISSUER}/.well-known/jwks.json`, cached 1h, refreshed once on an unknown `kid` for key rotation). Applied to every auditor-facing route in `main.py` (engagements, stakeholders, scope, generate-rfi, bulk-create, analyze, review/list, activity, preview-url) — 22 routes in total. Deliberately **not** applied to `GET /upload/{token}` (magic-link lookup) or `POST /evidence-requests/{id}/upload` (used by both the public stakeholder page and the authenticated auditor review panel today; kept exactly as-is per the constraint to preserve the existing public-upload contract). `CLERK_ISSUER`/`CLERK_JWKS_URL` are deliberately **not** added to `main.py`'s `REQUIRED_ENV_VARS` (which `sys.exit(1)`s the whole process on startup) — an unconfigured auth boundary instead fails *closed* per-request (503 "Auth is not configured"), so `/health` and local dev without Clerk secrets still boot. This app has no per-auditor engagement ownership model today (confirmed in `main.py`'s own `list_engagements` comment: "no per-user scoping exists yet... a real multi-tenant fix, not done here") — any authenticated auditor can see any engagement, which this session preserved rather than inventing a narrower model the rest of the app doesn't have. What *did* get real ownership enforcement (a data-integrity property, not an identity one): `_create_evidence_request_row` now requires `stakeholder_id` to belong to the target `engagement_id` (was: existence-only, globally) — this is finding #5, the one confirmed-100%-confidence cross-engagement bug. Frontend: `apps/web/src/lib/api.ts` gained `getAuthHeaders()`/`authedFetch()`, used on every call except the public upload-token lookup; works in both the server-component context (`@clerk/nextjs/server`'s `auth()`) and client-component context (`window.Clerk.session.getToken()`, since `scope-workflow.tsx`/`review-panel.tsx` are `"use client"` and call the backend directly from the browser — confirmed via `grep` that these are exactly the routes finding #1 named as unauthenticated).

3. **ISO remote-exclusion narrowing: exclude only genuinely-premises controls (9 of 14 A7 controls), not the whole A7 range.** `apps/api/app/services/scope_profiler.py`'s `_ISO_PREMISES_CONTROLS` now excludes only A7.1–A7.7 (perimeter/entry/offices/monitoring/environmental/secure-areas/clear-desk) plus A7.11 (supporting utilities) and A7.12 (cabling) when `ISO.SCP.4 == "fully_remote"`. Explicitly kept applicable: A7.8 (equipment siting — applies to home-office equipment), A7.9 ("Security of assets off-premises", tagged `remote-working` — this is the control that most applies to a remote org, not less), A7.10 (storage media, any location), A7.13 (equipment maintenance), A7.14 (secure disposal) — the exact "off-premises asset, media, maintenance, disposal" controls the handoff named. Full reasoning and per-control citation is in the module as a comment block. Test: `test_iso_fully_remote_excludes_only_premises_controls` in `apps/api/tests/test_scope_profiler.py`.

### Implementation scope 1–6 — what changed

**1. Auth + ownership (P0).** `apps/api/app/auth.py` (new). 22 routes in `main.py` gained `Depends(get_current_auditor_id)`. `_create_evidence_request_row` scopes the stakeholder lookup by `engagement_id` (fixes #5). Bulk-create validates every `stakeholder_id` belongs to the target engagement *before* inserting any row (see #4 below). `apps/web/src/lib/api.ts`'s `authedFetch` attaches the bearer token on every call except the public upload/lookup routes.

**2. Framework/DB contracts (P1).** SOC2 migration (above). `ensure_stakeholder_schema` now backfills `engagement_id` for legacy stakeholders (e.g. seed.py's `s1`) from their existing `evidence_requests` relationship, when that relationship points at exactly one engagement — fixes #14 without guessing when the data is ambiguous. `compute_engagement_scope` now additively writes into `engagement_frameworks` on every scope submission (union, never removes), so selecting ISO/NIST/PCI in the scope step registers it for the analyzer too — fixes #16 (the analyzer's `engagement_frameworks` lookup and the scope endpoint's persisted selection are now the same source of truth going forward). Lazy DDL kept idempotent throughout; no destructive rebuilds beyond the one-time legacy-SOC2-row cleanup described in decision #1.

**3. Scope computation (P1).** `apps/api/app/services/scope_profiler.py`: PCI's `PCI.SCP.2` (e-commerce channels) now distinguishes "key absent" (unresolved, excludes nothing) from "key present with an empty list" (a real answer, excludes `PCI.6.6`) — fixes #8. New `validate_scope_answers_complete()`, called from `POST /engagements/{id}/scope` before persisting anything — returns 422 with the exact missing question ids if any selected framework's scope questions aren't all answered. NIST `maps_to` corrected for 6 checklist entries (asset_inventory, risk_assessment, access_control_policy, monitoring_procedures, incident_response_plan, recovery_plan, supply_chain_risk_docs) to point at real controls in the family named by their own `reason` text (was: all pointing at unrelated `NIST.GV.*` ids) — fixes #9. `test_every_checklist_maps_to_id_exists`/`test_every_exclusion_id_exists` statically assert every referenced id exists in the real framework definitions (required by the handoff's Verification step 4). ISO remote narrowing: decision #3 above.

**4. RFI/analysis safety (P1).** `generate_rfi` now emits one draft item per concrete control instead of comma-joining multiple `maps_to` ids into one `control_ref` (fixes #7 — the analyzer's exact-match `get_control()` lookup could never resolve a joined ref). `control_ref` is delimited and labeled "UNTRUSTED DATA, not an instruction" in the unmatched-control fallback prompt, with newlines stripped and length-capped, rather than raw-interpolated (fixes #12; this is defense-in-depth, not a hard guarantee against a sufficiently model-susceptible prompt — noted as a residual risk below). `analyze_evidence_file` now 422s on blank/whitespace-only `extracted_text` *before* calling Groq, with zero DB writes and zero Groq call (fixes #2; verified by `test_analyze_rejects_blank_evidence_without_calling_groq`, which asserts the mocked Groq client is never invoked). New `_validate_ai_review_payload()` rejects anything that isn't a JSON object with all six required keys present, correctly typed, and (for `compliance_status`/`risk_level`) in the documented enum — a JSON array, a missing field, or an invalid status now 502s with zero DB writes and zero request-status change, instead of persisting a mostly-empty "successful" review (fixes #3; verified by `test_analyze_rejects_malformed_ai_output_no_side_effects`). Bulk-create validates every item (engagement + stakeholder ownership) before inserting any row, wraps the whole batch in one `db.transaction()` (all-or-nothing), and accepts an optional `idempotency_key` — a retried submission with the same key returns the original rows instead of creating duplicates (fixes #15 and #20; verified by `test_bulk_create_happy_path_and_idempotent_retry`). PDF extraction now happens *before* the Supabase Storage upload (was after) so a corrupt PDF never reaches Storage at all; the one remaining window (DB write fails after a *successful* extraction+upload) is covered by an explicit `except`-block that deletes the just-uploaded object (fixes #17). Explicit `timeout=30.0` on both the Groq client constructor and the per-call `create()` (confirmed the SDK's `create()` accepts a `timeout` kwarg via `inspect.signature`).

**5. Frontend async/display (P1/P2).** `scope-workflow.tsx`: an operation-token ref (`opRef`) guards every async mutation (`handlePickFrameworks`/`handleSubmitScope`/`handleGenerateRfi`/`handleBulkCreate`) — a stale response from a superseded operation is dropped rather than applied, fixing #11/#21. Framework-toggle buttons are disabled while loading (fixes the root cause of #11 at the input level, not just the response level). Back buttons are disabled while any mutation is pending (fixes #21). `fetchScopeQuestions`/`generateRfiDraft` in `api.ts` now return `{ok, ...} | {ok: false, message}` instead of collapsing every failure (network error, 404, malformed JSON) to `[]` — `scope-workflow.tsx` surfaces the real message and stays on the current step on any failure, and if *any* selected framework's questions fail to load, none of them are applied (fixes #18/#22, and the review's specific "partial results broaden computed scope" concern). Required-answer validation: every `single_select` scope question must have a real (non-blank) answer before "See evidence checklist" is enabled — client-side mirror of the backend's `validate_scope_answers_complete` (fixes the UI half of #8/#18). Bulk-create now sends a stable per-mount `idempotency_key` (lazily generated to satisfy the React-purity lint rule against calling `crypto.randomUUID()` during render). `review-panel.tsx` was already rendering the structured `compliance_status`/`current_state`/`gap_description`/`evidence_quote`/`follow_up_evidence`/`control_id_matched` fields correctly (built that way by the frontend session) — no changes needed there; it now benefits automatically from backend fix #19 below (real columns instead of `raw_response.text` parsing) without any frontend code change, since `mapWireAiReviewInner` already prefers the dedicated columns over the `parseRawAnalyzeText` fallback when both are present. The fallback itself was **not** removed — kept as a defensive path for the historical rows that predate the new `ai_reviews` columns (real, demonstrated need: this codebase's `ai_reviews` table isn't versioned/migrated, so old rows genuinely only have `raw_response.text`).

**6. Regression coverage.** 34 new backend tests across 3 files (`test_scope_profiler.py`, `test_auth.py`, `test_api_endpoints.py`) — see Verification below for exact coverage and how they were run. No frontend test framework exists in this repo (`apps/web/package.json` has no `test` script, no Jest/Vitest/Playwright dependency) — frontend correctness was verified via `tsc --noEmit`, `next build`, `eslint`, and structural reasoning about the guards added; this is a real gap, noted below.

### Additional fix not in the original list: shared-connection transaction hygiene

Found while writing `test_bulk_create_happy_path_and_idempotent_retry` (it hung indefinitely — see `pg_stat_activity` investigation). Root cause: this app holds one long-lived `psycopg` connection per process (`app.state.db`), and most read-only handlers (pre-existing, not introduced by this session) never called `.commit()`, leaving an "idle in transaction" session that holds whatever locks it acquired. My own new bulk-create `DELETE FROM engagement_frameworks WHERE framework NOT IN (...)` + `DROP/ADD CONSTRAINT` DDL (decision #1) needs an `ACCESS EXCLUSIVE` lock on `engagement_frameworks` on nearly every request, which deadlocked against any other never-committed transaction that had ever touched that table. Fixed at the root: `_connect_db()` now sets `conn.autocommit = True` (every statement commits on its own by default — eliminates the whole "forgot to call commit()" class of bug across the file, most of which pre-dates this session), and the three call sites that need several statements to succeed or fail together (bulk-create, upload+cleanup, analyze's persistence step) wrap that section in `with db.transaction():`, which works correctly under autocommit and gives real all-or-nothing semantics without the deadlock risk. This is a "smallest coherent fix that doesn't leave a landmine for the next request that touches DDL," not a broader refactor — no handler's query logic changed, only how/when the connection commits.

### Verification — exact commands and outcomes

1. **`git diff --check` and `git status`**: `git diff --check` → clean (no output). `git status --short` confirms the three preserved handoff docs and `apps/api/tests/fixtures/` are unchanged from their pre-existing dirty/untracked state (nothing in this session's diff touches them); `apps/api/.env` (created for local testing, see below) is untracked and `git check-ignore -v` confirms it's covered by `apps/api/.gitignore`.

2. **Backend tests.** No `.venv` existed in this checkout and `psycopg` isn't on the system Python (confirmed: `ModuleNotFoundError: No module named 'psycopg'`), matching the handoff's stated constraint. A working `.venv` with the full `requirements.txt` (now also `PyJWT`/`cryptography`, added for `auth.py`) already existed at `/Users/saqlainmomin/ai-audit-copilot-backend/apps/api/.venv/` from an earlier session on this same machine — reused its interpreter directly rather than reinstalling. Provisioned a real local Postgres database for this session (`createdb ai_audit_copilot_verify`; the `postgresql@16` server was already running on this machine from earlier work), wrote a local `apps/api/.env` with a real `DATABASE_URL` pointing at it and clearly-fake placeholder values for `GROQ_API_KEY`/`RESEND_API_KEY`/`SUPABASE_*`/`CLERK_ISSUER` (no real credentials anywhere in the repo or this file — the placeholders are only enough to pass `_check_required_env_vars()` and let routes that don't call those providers run for real against a real database).
   ```
   $ cd apps/api && export $(grep -v '^#' .env | xargs) && python seed.py
   Seeded one engagement, one stakeholder, one evidence request

   $ python -m pytest tests/ -q
   34 passed in 0.89s
   ```
   Coverage: `test_scope_profiler.py` (11 tests, pure functions — dangling `maps_to`/exclusion ids, PCI unanswered-vs-answered-empty, ISO premises-only exclusion, NIST family-correct mappings, completeness validation); `test_auth.py` (10 tests — valid/expired/wrong-issuer/tampered-signature/missing-claim tokens against a self-signed RSA JWKS double, plus the FastAPI dependency's 401/503 behavior); `test_api_endpoints.py` (13 tests, real Postgres + mocked Groq — unauthorized/invalid-token 401, authorized happy path, cross-engagement stakeholder rejection, bulk idempotent retry with a DB-row-count check, incomplete-scope 422, one-control-per-RFI-item with a "never comma-joined" assertion, blank-evidence 422 with a Groq-not-called assertion, malformed-AI-output 502 with a zero-side-effects assertion (status unchanged, no `ai_reviews` row), valid-output persistence with the structured fields round-tripping through `GET .../review`, and the unmatched-control-ref fallback including a literal prompt-injection attempt in the `control_ref` field). Re-ran on a freshly-dropped-and-recreated database after the autocommit fix (above) — same 34/34, confirming the fix and no hidden dependency on state left over from an earlier run.
   Existing pre-session test (`test_smoke.py`, health check): still passes, no regression.

3. **Frontend lint/typecheck/build.**
   ```
   $ npx tsc --noEmit          # clean (0 errors) — the two PageProps/LayoutProps
                                 errors seen before a first `next build` are Next.js
                                 15/16's known "types generated at build time" gap,
                                 not real errors; confirmed gone after building once.
   $ npm run build              # ✓ Compiled successfully, ✓ TypeScript, ✓ 18/18
                                 static pages generated, including the new /scope route.
   $ npx eslint .                # 1 error: review-panel.tsx:135, a pre-existing
                                 set-state-in-effect warning the frontend session
                                 explicitly flagged as "not introduced by this
                                 session, unrelated to this feature" — left alone
                                 per "avoid unrelated refactors." Zero errors in
                                 every file this session touched.
   ```
   No frontend test script/framework exists in this repo (`package.json` has no `test` command) — this is a real, pre-existing gap; frontend correctness rests on `tsc`/`eslint`/`next build` plus code-level reasoning about the added guards, not executed frontend tests.

4. **Static assertions on `maps_to` IDs / unresolved-answer handling.** Covered by `test_every_checklist_maps_to_id_exists`, `test_every_exclusion_id_exists`, `test_pci_unanswered_ecommerce_does_not_exclude`, and `test_iso_missing_remote_answer_excludes_nothing` in `test_scope_profiler.py` (all passing, see above).

5. **Combined smoke test.** Full authenticated end-to-end flow (select frameworks → answer questions → compute scope → inspect exclusions/controls → generate RFI → bulk-create → upload → analyze → reload review) is exercised by `test_api_endpoints.py`'s `test_scope_complete_and_generate_rfi_splits_multi_control_items` + the three `test_analyze_*` tests, using `app.dependency_overrides` for a deterministic authorized identity (real Clerk sign-in isn't available in this environment — no `.env.local`/Clerk keys exist in this checkout, and provisioning a real Clerk test instance was out of scope for this session) and a mocked Groq client (real `GROQ_API_KEY` isn't available either, and the constraint requires mocking AI in automated tests regardless). Separately, hit a **live** `uvicorn` server with real `curl` to confirm the auth boundary itself works end-to-end outside the test harness:
   ```
   $ curl -s http://localhost:8011/health
   {"status":"ok"}
   $ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8011/engagements
   401
   $ curl -s http://localhost:8011/engagements/eng_001/scope -w "\nHTTP:%{http_code}\n"
   {"detail":"Missing bearer token"}
   HTTP:401
   ```
   Unauthorized access, invalid-claim rejection (`Authorization: Bearer garbage` → `401 {"detail":"Invalid or expired token: Not enough segments"}`, run earlier in this session), and cross-engagement access are all covered by the pytest suite's real-Postgres tests above. **Not verified**: a real end-to-end run against live Groq/Supabase/Clerk — this session had no credentials for any of the three, consistent with "mock AI/storage in automated tests" and "never add credentials... to source, tests, or handoff output."

6. **Re-running focused tests after integration.** Done throughout — the full `pytest tests/` suite (34 tests) and `next build` were both re-run clean after every group of changes (auth, scope_profiler, main.py's analyze/bulk rewrite, the autocommit fix, and the frontend edits), not just once at the end.

### Changed files

Backend: `apps/api/app/auth.py` (new), `apps/api/app/main.py`, `apps/api/app/services/scope_profiler.py`, `apps/api/app/upload_lookup.py`, `apps/api/requirements.txt`, `apps/api/seed.py`, `apps/api/tests/test_auth.py` (new), `apps/api/tests/test_scope_profiler.py` (new), `apps/api/tests/test_api_endpoints.py` (new).
Frontend: `apps/web/src/lib/api.ts`, `apps/web/src/lib/types.ts`, `apps/web/src/lib/format.ts`, `apps/web/src/lib/mock-data.ts`, `apps/web/src/components/scope/scope-workflow.tsx` (integrated from `frontend/scope-rfi-ui`, then edited), `apps/web/src/components/scope/` route files (integrated), `apps/web/src/components/review/review-panel.tsx` (integrated, unedited beyond the branch diff), `apps/web/src/components/badges.tsx` (integrated), `apps/web/src/components/app-shell.tsx` (integrated), `apps/web/src/components/engagements/new-engagement-form.tsx`, `apps/web/src/app/(auth)/engagements/[engagementId]/scope/page.tsx` (integrated).
Local-only, gitignored, not part of the diff: `apps/api/.env` (placeholder credentials for local testing).

### Remaining blockers / unresolved items

- **No real Clerk/Groq/Supabase credentials available in this environment** — the auth boundary, scope/RFI computation, and AI-output-validation logic are all verified with deterministic mocks/fixtures per the constraints, but a fully live run (real Clerk sign-in through the browser, real Groq call, real Supabase upload) was not performed in this session. The backend and frontend sessions that originally built this feature did have real credentials at the time and ran that full live path once (see their own Results sections) — this session's job was correctness fixes, verified as thoroughly as the available environment allows.
- **No frontend test framework in the repo** — `tsc`/`eslint`/`next build` plus manual code-path reasoning are the only frontend verification available; adding Jest/Vitest/Playwright is a real gap but a separate, larger decision (tooling choice, CI wiring) than this handoff's scope.
- **`control_ref` prompt-injection mitigation is defense-in-depth, not a hard guarantee** (decision #2/finding #12) — delimiting and labeling untrusted text reduces a crafted `control_ref`'s ability to alter model behavior but doesn't eliminate it categorically; a determined adversarial input could still influence the model. Full mitigation would require either constraining `control_ref` to known IDs only (rejected — breaks the documented "auditor can type an arbitrary control ref" design) or a structurally different prompt architecture (e.g. a tool-call boundary) not in scope for this pass.
- **`seed.py`'s seeded evidence request still carries a stale SOC2-era `control_ref` ("CC6.2")** — left as-is; the analyze endpoint's graceful fallback already handles an unmatched ref, and rewriting seeded content beyond the framework value itself was judged out of scope for "smallest coherent change."
- **Local verification Postgres database** (`ai_audit_copilot_verify`) and `apps/api/.env` are artifacts of this session's local testing, not part of the repo — safe to drop/regenerate; noting their existence here so they're not mistaken for something that needs cleanup in the codebase itself.
