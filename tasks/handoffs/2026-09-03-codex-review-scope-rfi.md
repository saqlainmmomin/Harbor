# Codex: adversarial review of scope/RFI/analyze work

## Goal

Adversarially review two branches of `ai_audit_copilot` (pushed to
`https://github.com/saqlainmmomin/Harbor`, not the original `origin` remote) that add a
scope → RFI → control-aware-analysis workflow, split across a backend session and a frontend
session. Both sessions wrote their own "Results" sections claiming the work is complete and
verified — your job is to find what they got wrong, glossed over, or didn't actually verify
despite claiming to, not to re-confirm what they already said. Definition of done: a written
review (see Report back) that either says the work is solid with specific reasoning, or lists
concrete, cited problems — no vague "looks fine" or vague "could be improved" without a specific
finding.

## Current state

- Repo: `/Users/saqlainmomin/ai_audit_copilot` (clone or use this path directly), remote `harbor`
  → `https://github.com/saqlainmmomin/Harbor.git`.
- `main` (harbor) has the backend work: commit `7fbd02d` (scope engine, RFI generation,
  bulk-create, control-aware analyze endpoint) and `1138b05` (docs/README update on top of it).
- `frontend/scope-rfi-ui` (harbor) has the frontend work: single commit `84e4858`, branched from
  `main` at `1138b05` — i.e. it is exactly one commit ahead of `main`, not yet merged via PR.
- Both branches are already pushed. Neither has been reviewed by anyone or anything other than
  the sessions that wrote the code. Nothing has been merged into `frontend/scope-rfi-ui` back
  into `main` yet — that's a decision to make after this review, not before.
- Full spec + implementation notes + real verification output from each session are written up
  in-repo — **read these first, in full, before looking at any code**:
  - `tasks/handoffs/2026-09-03-backend-scope-rfi-analysis.md` — backend spec (top) +
    `## Results` (bottom) with the actual `curl` commands and output the backend session ran.
  - `tasks/handoffs/2026-09-03-frontend-scope-rfi-analysis.md` — frontend spec (top) +
    `## Results` (bottom), including two self-reported "contract deviations" (see below).
  - `/Users/saqlainmomin/.claude/plans/zany-gliding-catmull.md` — the original approved plan
    behind both sessions; treat as authoritative context for *why* decisions were made, but not
    as proof the resulting code is correct.

## Key files

Backend (`main`, commit `7fbd02d`):
- `apps/api/app/services/scope_profiler.py` — new scope-exclusion rule tables for
  ISO27001/NIST_CSF/PCI_DSS + `compute_scope`/`compute_scope_multi`/evidence-checklist builder.
- `apps/api/app/frameworks/definitions/iso27001.py`, `nist_csf.py`, `pci_dss.py` — the control
  definitions the rule tables in `scope_profiler.py` reference by ID. **Cross-check every control
  ID referenced in `scope_profiler.py`'s exclusion tables actually exists in these files** — a
  typo'd or stale ID would silently no-op an exclusion rule instead of erroring.
- `apps/api/app/main.py` — the scope/RFI/bulk-create/analyze endpoints (search for
  `/scope`, `/generate-rfi`, `/evidence-requests/bulk`, `/analyze`), plus the diff removing
  automatic AI review from `upload_evidence_file`.
- `apps/api/app/upload_lookup.py` — extended lookups used by the analyze endpoint.

Frontend (`frontend/scope-rfi-ui`, commit `84e4858` — diff against `main`):
- `apps/web/src/lib/api.ts` — new client functions + `mapWireAiReviewInner`'s
  `parseRawAnalyzeText` fallback parser (see "focus area" below).
- `apps/web/src/lib/types.ts` — new types, including the deliberately-separate `ScopeFramework`
  type (see contract deviation #1 in the frontend Results section).
- `apps/web/src/app/(auth)/engagements/[engagementId]/scope/page.tsx` +
  `apps/web/src/components/scope/scope-workflow.tsx` — the scope/RFI screen.
- `apps/web/src/components/review/review-panel.tsx` — the Analyze/Re-analyze button and new
  result rendering, plus the old-field fallback path for pre-existing reviews.
- `apps/web/src/components/badges.tsx` — new `ComplianceStatusBadge`.

## Constraints

- Do not merge either branch into anything, do not push, do not open a PR. This is a read-only
  review pass.
- Do not modify the codebase. If you want to test a fix for something you find, note it in the
  review as a recommendation — don't apply it.
- Treat both sessions' "Results" sections as *claims to verify*, not as ground truth. Where you
  can cheaply re-run their own verification (e.g. starting the server and hitting an endpoint),
  do so rather than trusting the pasted output at face value.

## Focus areas (in priority order)

1. **Scope-exclusion correctness**: for each framework's rule table in `scope_profiler.py`, does
   the set of excluded control IDs for each "no"/false scope answer actually match what those
   controls are about, per the control definitions in `frameworks/definitions/*.py`? Look for
   controls that should be excluded but aren't, or controls excluded for the wrong reason.
2. **Analyze endpoint safety**: does `POST /evidence-files/{file_id}/analyze` actually degrade
   gracefully for every bad input — missing/garbage `control_ref`, a request with no engagement
   frameworks, a file with no extracted text, a malformed Groq response — or does any of these
   paths 500 or throw unhandled? The backend Results section claims one fallback case was tested;
   check whether the code handles the others it didn't test.
3. **`parseRawAnalyzeText` fragility** (`apps/web/src/lib/api.ts`): this parses Groq's
   `raw_response.text` as a fallback when the dedicated `ai_reviews` columns are null. What
   happens if Groq's response shape changes, the JSON is truncated, or the field is missing
   entirely — does it throw and break the whole review-panel render, or fail silently with a
   sensible fallback? This is exactly the kind of workaround that looks fine in the one case it
   was tested against and breaks in production on the first edge case.
4. **General code quality** against the existing codebase's own conventions (lazy-DDL pattern,
   comment style, existing component/form patterns) — flag real deviations, not style
   preferences.
5. **Gaps between what each Results section claims and what the code actually does** — e.g. if a
   session says "X is handled" but the code path shows otherwise, that's the most valuable class
   of finding here.

## Known non-blocking loose ends (context, not necessarily your job to fix)

1. `apps/web/src/app/sign-in/` and `apps/web/src/app/sign-up/` were left **untracked and
   uncommitted** in the frontend session's worktree — stray `npx clerk@latest init` scaffolding
   that duplicates the already-existing `(auth)/sign-in` and `(auth)/sign-up` routes and would
   cause a Next.js duplicate-route build error if ever committed. They were deliberately excluded
   from commit `84e4858` and do not exist on the `frontend/scope-rfi-ui` branch. Nothing to do
   here — just don't be confused if you see them mentioned in transcripts and don't find them in
   the diff.
2. `GET /evidence-requests/{id}/review` doesn't surface the new `ai_reviews` columns
   (`compliance_status` etc.) directly — the frontend works around this by parsing
   `raw_response.text` (see focus area 3). Whether this should instead be fixed properly on the
   backend (have that endpoint return the real columns) is a legitimate call to make in your
   review — flag it as a recommendation if you agree it's worth doing for real rather than
   working around.

## Verification

Where feasible, actually run the code rather than reading it in isolation:
- Start the backend (`cd apps/api && uvicorn app.main:app --reload --port 8000`, needs a `.env`
  — real credentials exist at `/Users/saqlainmomin/ai-audit-copilot-backend/apps/api/.env` if you
  need to borrow them for a local check, or use your own test values for anything that doesn't
  need a real Groq/Supabase call).
- Hit the analyze endpoint with deliberately bad input (nonsense `control_ref`, a `file_id` that
  doesn't exist) and confirm the actual HTTP status/response, not what the Results section says
  it should be.
- For the frontend fragility question, it's fine to reason from the code (trace what
  `parseRawAnalyzeText` does with malformed/missing input) rather than standing up the full
  Clerk-gated UI — that's a heavier lift than this review needs.

## Report back

Append a `## Codex Review` section to this file with:
- A short verdict per focus area (1–5 above).
- Concrete findings, each with a file:line reference and a one-line reproduction/explanation of
  the failure mode — not just "this could be better."
- Anything you explicitly checked and found to be fine (so the next reader knows it was actually
  checked, not skipped).
- Your recommendation: merge as-is, merge with the specific fixes you list, or don't merge yet
  and why.

## Results

## Codex Review

Scope: Read-only review of backend db836c3..1138b05 and frontend db836c3..84e4858. The frontend head is based on db836c3, not on backend head 1138b05, so the claimed end-to-end result was not produced from one merged commit.

Intent: Add framework-aware scope profiling, RFI generation, decoupled evidence upload, control-aware Groq analysis, and the matching frontend workflow.

Mode: Markdown report-only. No code was changed, merged, pushed, or committed.

Reviewers: correctness, security, testing, maintainability, api-contract, reliability, adversarial, julik-frontend-races, and project-standards. Project standards found no explicit violation. The selected adversarial and frontend-race passes were used because this change combines data mutation, an external AI dependency, and several new async UI flows.

### Triage Groups

| Group | Findings | Type | Context | Preferred Resolution | Why |
|---|---|---|---|---|---|
| Tenant and prompt boundary | #1, #5, #12 | Decision gate plus apply queue | New browser-facing mutations lack a backend trust boundary. | Decide the Clerk-to-FastAPI auth contract first. Then enforce engagement ownership, stakeholder ownership, and safe control-reference handling. | These issues can expose or mutate another engagement and can alter the model instruction. |
| Framework migration and source of truth | #4, #13, #14, #16, #19 | Apply queue | Legacy framework and stakeholder rows, scope rows, analyzer rows, and list endpoints use different contracts. | Migrate or preserve legacy data. Then make scope, analysis, and list endpoints read one typed source. | The normal seeded flow currently degrades or fails before control-aware analysis. |
| Analysis trust boundary | #2, #3, #7, #17 | Apply queue | Empty evidence, invalid model output, compound controls, and upload ordering can produce false review state. | Validate evidence and model output before persistence. Use one analyzable control per request. Clean up storage on extraction failure. | Audit results must not be recorded when the input or provider response is invalid. |
| Scope correctness | #8, #9, #10, #18 | Decision gate plus apply queue | Unanswered or incorrectly mapped scope inputs change the required-control set. | Block unresolved answers. Correct NIST mappings. Narrow ISO remote exclusions. | A wrong checklist causes missing evidence requests. |
| Async workflow state | #11, #21, #22 | Apply queue | Selection changes and late or rejected requests can move the UI to an invalid step. | Add operation tokens or cancellation guards and explicit error results. | The user can otherwise submit stale or incomplete scope data. |
| Bulk request lifecycle | #15, #20 | Apply queue | Batch errors and retries can create partial or duplicate evidence requests. | Validate before insert, roll back on failure, and add idempotency. | The request ledger must remain truthful after retries and failures. |

### P0 -- Critical

| # | File | Issue | Reviewer | Confidence |
|---|---|---|---|---|
| 1 | apps/api/app/main.py:398,1054 | New auditor APIs have no backend authentication | security | 75 |

- #1 - The new bulk-RFI and analyze routes have no Depends, auth middleware, or ownership check. The frontend calls the API from the browser. An unauthenticated caller can read or mutate engagement data and trigger Groq analysis by ID. Add a shared Clerk-to-FastAPI authentication boundary and engagement, request, and file ownership checks. This is a human decision gate because the token contract must be chosen. Confidence 75; independently confirmed by source inspection, but the validator batch did not return.

### P1 -- High

| # | File | Issue | Reviewer | Confidence |
|---|---|---|---|---|
| 2 | apps/api/app/main.py:1129 | Analyze accepts empty evidence as auditable input | adversarial | 100 |
| 3 | apps/api/app/main.py:1164 | Malformed AI JSON is recorded as completed review | correctness, reliability, adversarial | 100 |
| 4 | apps/api/app/main.py:155 | SOC2 default and legacy paths are rejected by the new framework set | correctness, api-contract, adversarial | 100 |
| 5 | apps/api/app/main.py:343,398 | Bulk RFI accepts cross-engagement stakeholder IDs | security | 100 |
| 6 | apps/api/app/main.py:717 | New scope and analysis workflow has no regression tests | testing | 100 |
| 7 | apps/api/app/main.py:776 | Multi-control RFI refs never match analyzer controls | correctness, adversarial | 100 |
| 8 | apps/api/app/services/scope_profiler.py:102 | Unanswered PCI scope defaults to exclusion | correctness | 100 |
| 9 | apps/api/app/services/scope_profiler.py:210 | NIST checklist points evidence at wrong controls | correctness | 100 |
| 10 | apps/api/app/services/scope_profiler.py:60 | Fully remote ISO scope excludes controls that protect remote assets | adversarial | 100 |
| 11 | apps/web/src/components/scope/scope-workflow.tsx:62 | Framework selection changes during question loading | julik-frontend-races | 100 |
| 12 | apps/api/app/main.py:1105 | Control reference can inject the audit system prompt | security | 75 |
| 13 | apps/api/app/main.py:199 | SOC2 migration can fail schema bootstrap | correctness | 75 |
| 14 | apps/api/app/main.py:318 | Legacy stakeholders disappear from scope RFI | correctness | 75 |
| 15 | apps/api/app/main.py:412 | Bulk RFI failure can leave partial inserts | correctness | 75 |
| 16 | apps/api/app/main.py:729 | Scope frameworks are not registered for analysis | correctness, adversarial | 75 |
| 17 | apps/api/app/main.py:921 | PDF extraction failure creates false received state | correctness | 75 |
| 18 | apps/web/src/components/scope/scope-workflow.tsx:80 | Partial scope-question failures broaden computed scope | correctness, reliability | 75 |

- #2 - extracted_text is converted to an empty prompt and sent to Groq. The endpoint then persists the response and sets pending_review. A scanned or extraction-empty PDF can receive a model verdict without evidence. Return 422 or an explicit not_assessed state before calling Groq. Confidence 100; single-reviewer finding validated by the code path.
- #3 - Syntax-invalid output becomes {} and is persisted as a review with pending_review. A valid JSON array or string reaches .get(...) and can raise an unhandled 500. Validate the complete object, field types, required keys, and allowed enums before persistence or status mutation. Confidence 100; corroborated by correctness, reliability, and adversarial review.
- #4 - VALID_FRAMEWORKS excludes SOC2, but the default new-engagement form still selects SOC2 at apps/web/src/components/engagements/new-engagement-form.tsx:19 and the seed still inserts SOC2 at apps/api/seed.py:83. The default create flow gets HTTP 400. Choose a compatibility window or update the client and seed atomically. Confidence 100; corroborated by correctness, api-contract, and adversarial review.
- #5 - The shared insert helper checks only SELECT id FROM stakeholders WHERE id = %s. A stakeholder from engagement A can be attached to a bulk request for engagement B. Scope the lookup by engagement_id, and add an ownership test. Confidence 100; security finding.
- #6 - The diff adds no API or frontend tests for scope persistence, exclusions, RFI mapping, analysis failure, or bulk error states. The only visible backend test is the health check. Add focused endpoint and component tests before relying on the claimed end-to-end verification. Confidence 100; testing finding.
- #7 - generate_rfi joins multiple maps_to IDs into one comma-separated control_ref. Analysis uses exact get_control lookup. The generated request therefore falls into the generic prompt and is not control-aware. Emit one request per control or require one target control. Confidence 100; corroborated by correctness and adversarial review.
- #8 - With no PCI.SCP.2 answer, channels is empty and the code excludes PCI.6.6. The UI permits blank answers. Missing information is treated as proof that e-commerce is absent. Block unresolved answers or mark scope unresolved. Confidence 100; correctness finding.
- #9 - The asset inventory, risk, access, monitoring, incident, recovery, and supply-chain checklist entries use NIST.GV.* references even though their reasons name NIST.ID.AM, NIST.ID.RA, NIST.PR.AA, NIST.DE, NIST.RS, NIST.RC, and NIST.GV.SC. The generated RFIs point to the wrong controls. Replace each maps_to list with IDs present in its named family. Confidence 100; correctness finding.
- #10 - ISO.SCP.4=fully_remote excludes all A7 controls. The definitions show ISO.A7.9 is Security of assets off-premises; it still applies to remote laptops and other off-premises assets. Narrow the exclusion set. This is a scope-semantic decision gate. Confidence 100; adversarial finding and pure-function repro.
- #11 - Framework toggles stay enabled while Promise.all loads questions. If the selection changes during the request, the completion builds answers for one selection but transitions using the newer selection. The questions screen can contain a selected framework with no questions. Snapshot or invalidate the operation. Confidence 100; frontend-race finding.
- #12 - Raw control_ref is interpolated into the system message. A crafted auditor-entered reference can add instruction text to the model context. Validate known IDs and delimit unknown references as untrusted data. Confidence 75; security finding.
- #13 - Existing engagement_frameworks rows with SOC2 survive until the new check is added, then violate the new check. Add a compatibility migration or preserve SOC2 until data is migrated. Confidence 75; correctness finding.
- #14 - The seed creates the stakeholder without engagement_id, while the new list query filters by engagement_id. The seeded stakeholder is absent from the scope/RFI screen, so generated rows start without an assignable contact. Backfill the relationship. Confidence 75; correctness finding.
- #15 - If an early bulk item inserts successfully and a later item raises, the endpoint has no explicit rollback. The shared connection can commit earlier rows during a later successful request. Validate all items first and roll back on failure. Confidence 75; correctness finding.
- #16 - Scope submission stores selected frameworks only in engagement_scope. Analysis reads engagement_frameworks. Selecting ISO or NIST in scope does not register it for analysis, so known controls silently use the generic prompt. Synchronize the tables or use one source of truth. Confidence 75; corroborated by correctness and adversarial review.
- #17 - Supabase upload occurs before PDF extraction. A corrupt PDF can return an extraction error after its storage object already exists, leaving an orphaned object and no database row. Extract first or delete the object on failure. Confidence 75; correctness finding.
- #18 - A non-OK scope-question response becomes an empty list. If one selected framework succeeds and one fails, the UI proceeds and allows an incomplete scope submission. Return typed errors and block progression on any failure. Confidence 75; corroborated by correctness and reliability review.

### P2 -- Moderate

| # | File | Issue | Reviewer | Confidence |
|---|---|---|---|---|
| 19 | apps/api/app/main.py:1168,1217 | Persisted control-aware analyses are blank in GET/list consumers | correctness | 100 |
| 20 | apps/api/app/main.py:399 | Repeated bulk-create actions duplicate RFI requests | adversarial | 100 |
| 21 | apps/web/src/components/scope/scope-workflow.tsx:102 | Late scope completion overrides the user's current step | julik-frontend-races | 100 |
| 22 | apps/web/src/components/scope/scope-workflow.tsx:71 | Rejected scope-question fetch becomes unhandled | julik-frontend-races | 100 |

- #19 - Analysis writes only compliance_status and follow_up_evidence, while GET review and the flattened evidence list select only the old summary fields. The Evidence page can show a control-aware review as Reviewed with partial defaults. The review page also depends on parsing raw_response.text in apps/web/src/lib/api.ts:177. Return typed structured fields from the backend and update all consumers. Confidence 100; correctness finding.
- #20 - Repeating the bulk request after a timeout creates a second set of rows and activity entries. Add idempotency or a uniqueness policy. Confidence 100; adversarial finding.
- #21 - The user can press Back while scope submission is pending. A late success unconditionally sets the checklist step. Add a cancellation or operation-token guard. Confidence 100; frontend-race finding.
- #22 - fetchScopeQuestions does not catch network or JSON errors. Promise.all rejects, finally only clears loading, and the UI receives no error state. Catch the failure and keep the user on framework selection. Confidence 100; frontend-race finding.

### Requirements Completeness

- [x] Framework definitions and scope-question endpoints are present.
- [ ] Scope exclusions are not complete: PCI unanswered input, NIST mappings, and ISO remote exclusions need correction.
- [ ] RFI generation is not aligned with the single-control analysis contract.
- [ ] Upload/analyze decoupling is present, but empty evidence and extraction-failure handling are unsafe.
- [ ] The frontend workflow is present, but partial failures and async races are not safe.
- [ ] Verification is incomplete: no new regression tests were added, and the local test command failed during import.

### Actionable Findings

- #2 P1 apps/api/app/main.py:1129 - Reject blank evidence before Groq (gated_auto -> downstream-resolver, confidence 100).
- #3 P1 apps/api/app/main.py:1164 - Validate model shape before review persistence (gated_auto -> downstream-resolver, confidence 100).
- #4 P1 apps/api/app/main.py:155 - Reconcile SOC2 migration and default client behavior (gated_auto -> downstream-resolver, confidence 100).
- #5 P1 apps/api/app/main.py:343 - Enforce stakeholder ownership (gated_auto -> downstream-resolver, confidence 100).
- #6 P1 apps/api/app/main.py:717 - Add scope, RFI, analyze, and frontend regression tests (gated_auto -> downstream-resolver, confidence 100).
- #7 P1 apps/api/app/main.py:776 - Emit single-control RFI items (gated_auto -> downstream-resolver, confidence 100).
- #8 P1 apps/api/app/services/scope_profiler.py:102 - Block unresolved PCI answers (gated_auto -> downstream-resolver, confidence 100).
- #9 P1 apps/api/app/services/scope_profiler.py:210 - Correct NIST maps_to IDs (gated_auto -> downstream-resolver, confidence 100).
- #13 P1 apps/api/app/main.py:199 - Add a safe SOC2 schema migration (gated_auto -> downstream-resolver, confidence 75).
- #14 P1 apps/api/app/main.py:318 - Backfill legacy stakeholder ownership (gated_auto -> downstream-resolver, confidence 75).
- #15 P1 apps/api/app/main.py:412 - Roll back failed bulk transactions (gated_auto -> downstream-resolver, confidence 75).
- #16 P1 apps/api/app/main.py:729 - Use one framework source for scope and analysis (gated_auto -> downstream-resolver, confidence 75).
- #17 P1 apps/api/app/main.py:921 - Clean up storage on extraction failure (gated_auto -> downstream-resolver, confidence 75).
- #18 P1 apps/web/src/components/scope/scope-workflow.tsx:80 - Block partial question loads (gated_auto -> downstream-resolver, confidence 75).
- #19 P2 apps/api/app/main.py:1168 - Return structured analysis fields to all consumers (gated_auto -> downstream-resolver, confidence 100).
- #20 P2 apps/api/app/main.py:399 - Add bulk-create idempotency (gated_auto -> downstream-resolver, confidence 100).
- #21 P2 apps/web/src/components/scope/scope-workflow.tsx:102 - Ignore late mutation completions (gated_auto -> downstream-resolver, confidence 100).
- #22 P2 apps/web/src/components/scope/scope-workflow.tsx:71 - Surface rejected question loads (gated_auto -> downstream-resolver, confidence 100).

Decision gates before or alongside the queue: #1 backend authentication and ownership contract, #10 ISO remote-control semantics, and #12 safe treatment of free-text control references.

### Coverage

- Final mechanics pass: 22 primary findings, 0 suppressed, and 0 malformed.
- Reviewer coverage: all nine selected reviewer roles returned. No reviewer was dropped for capacity after correction.
- Cross-model corroboration: not run. All persona findings are same-model review passes. The independent validator batch for P0/P1 findings did not return after bounded waits and was shut down, so P0/P1 findings are validation-degraded.
- Local checks: pure scope-profiler execution found no dangling ISO or PCI exclusion IDs; it reproduced PCI.6.6 exclusion for empty PCI answers and ISO.A7.9 exclusion for fully remote scope. Both reviewed diffs pass git diff --check.
- Local test check: pytest -q could not collect because the available environment lacks psycopg, so the live endpoint smoke test was not run.
- Claim discrepancy: the handoff says NIST has 82 controls; the checked definition contains 94. The handoff's real-Groq end-to-end claim was not independently reproduced.
- Residual risks: main.py is now over 1,000 lines; AI-review DDL is duplicated in upload_lookup.py; Groq has no explicit timeout; RFI generation collapses dependency failures to an empty list; and the raw-response fallback remains tightly coupled to provider payload shape.
- Testing gaps: no frontend tests cover selection changes, Back during pending mutations, rejected question loads, empty RFI drafts, or bulk-create errors. No API tests cover malformed model output, empty extracted text, scope/analyzer framework alignment, NIST mappings, PCI unanswered input, or retry/rollback behavior.
- Settlement suppression: the discovered plan was inferred from .claude/plans; no session-settled decision was found, so settlement suppression was not evaluated.

### Verdict

> Not ready.
>
> Reasoning: The new browser-facing API has no backend authorization boundary. The default framework path rejects SOC2, scope selection does not feed the analyzer's framework source, several checklist mappings are wrong, and malformed or empty analysis input can become a persisted audit result. These are release-blocking correctness and trust-boundary issues.
>
> Fix order: Resolve #1, #4, #13, #14, and #16 as the framework and tenant contract. Then fix #2, #3, #7, #8, #9, #10, #12, and #17. Add the regression tests in #6. Finish the async UI fixes in #11, #18, #21, and #22 before re-running the combined frontend/backend smoke test.
