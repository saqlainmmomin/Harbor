# Codex review: scope/RFI fixes

Scope: Harbor PR #1, `fix/scope-rfi-workflow-safety` at `1c196f0`, reviewed against `harbor/main` at `02475be`.

Intent: repair the original scope -> RFI -> upload -> control-aware-analysis workflow findings without merging or pushing. This was a report-only review. The external independent-model pass was not run because sending repository code to the external provider was not approved; a local adversarial fallback and an independent validation pass were used.

## Original-review checklist

| Original # | Status | Evidence and review result |
|---|---|---|
| 1 - missing backend auth | Partially fixed | `apps/api/app/auth.py:86-105` verifies RS256 signature, issuer, expiry, issued-at, and subject; auditor routes use the dependency. But `auth.py:132` accepts every valid Clerk subject, while `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/page.tsx:11` allows sign-up and `main.py:732-738` lists every engagement. A non-auditor can therefore access all audit data. |
| 2 - blank evidence analyzed | Fixed | `apps/api/app/main.py:1369-1374` returns 422 before Groq or persistence; `test_api_endpoints.py:236-249` checks no Groq call and no review row. |
| 3 - malformed AI output persisted | Fixed | `main.py:1300-1322` validates a complete object and enums before `main.py:1491-1516` writes the review/status/activity transaction. |
| 4 - SOC2 default mismatch | Partially fixed | `seed.py` and `new-engagement-form.tsx` now use ISO27001/NIST_CSF/PCI_DSS, but existing SOC2 associations are deleted rather than migrated; see #13. |
| 5 - cross-engagement stakeholder in bulk RFI | Fixed | `main.py:548-562` validates all stakeholder IDs against the target engagement before inserts; `test_api_endpoints.py:120-140` exercises the rejection. |
| 6 - no regression coverage | Partially fixed | Focused auth, scope, and API tests now exist and are meaningful for covered cases. The local run was `21 passed, 1 skipped`; the DB-dependent endpoint module was skipped here, and key protected routes and frontend flows remain untested. |
| 7 - comma-joined RFI controls | Fixed | `main.py:996-1007` emits an item per `maps_to` control, and `test_api_endpoints.py:194-200` checks no comma-joined value. |
| 8 - unanswered PCI scope excludes a control | Partially fixed | A missing key is handled correctly in `scope_profiler.py:136-147`, but completeness at `scope_profiler.py:424-430` checks only key presence. An empty or invalid `PCI.SCP.2` value still excludes `PCI.6.6`; see Finding #5. |
| 9 - wrong NIST mappings | Fixed | The six mappings in `scope_profiler.py:244-294` reference the named NIST families, and `test_scope_profiler.py:87-118` validates the families and ID existence. |
| 10 - overly broad ISO remote exclusion | Partially fixed | `scope_profiler.py:45-69` correctly narrows the excluded set to nine premises controls, but `compute_scope` retains a mixed checklist item unchanged at `:400-403`. `generate_rfi` then recreates requests for its excluded controls; see Finding #4. |
| 11 - framework changes during question loading | Fixed | `scope-workflow.tsx:77-129` snapshots selection, freezes framework toggles, and applies an operation token. |
| 12 - control-ref prompt injection | Not fixed | `main.py:1398-1408` still interpolates free text into the system message. Newline normalization and a natural-language warning do not make it data rather than instructions; see Finding #3. |
| 13 - SOC2 schema bootstrap/migration | Not fixed | `main.py:232` permanently deletes legacy SOC2 rows before replacing the constraint, with no mapping, archive, rollback, or post-deploy verification; see Finding #2. |
| 14 - legacy stakeholders invisible | Fixed | `main.py:319-349` backfills only unambiguous stakeholder-to-engagement relationships, and new rows set `engagement_id`. |
| 15 - partial bulk inserts | Fixed for ordinary failures | `main.py:563-580` validates first and wraps inserts/activity/idempotency record in a transaction. Concurrent same-key retries are still unsafe; see Finding #7. |
| 16 - scope/analyzer framework source diverges | Partially fixed | Scope adds selected frameworks at `main.py:934-938`, so a first selection is analyzable. Re-scoping never removes deselected frameworks, while analysis reads the additive table at `:1360`; see Finding #6. |
| 17 - PDF extraction leaves an orphan | Fixed on the server | `main.py:1144-1157` extracts before storage, and `:1203-1211` attempts cleanup on DB failure. The public client now falsely labels a pre-upload extraction failure as received; see Finding #11. |
| 18 - partial question-load failure | Fixed | `scope-workflow.tsx:96-104` blocks progression and reports every failed framework; `api.ts:690-710` returns typed failures. |
| 19 - persisted analysis absent from consumers | Partially fixed | Request/review responses now include structured columns (`main.py:1553-1582`, `upload_lookup.py:339-365`). The flattened Evidence list still selects only legacy nullable fields at `upload_lookup.py:458-470`, so `evidence-files-table.tsx:77-81` presents a control-aware review as generic partial/zero-flag output. |
| 20 - duplicate bulk retry | Partially fixed | Sequential retries return the earlier rows, but the idempotency key is claimed only after request inserts. Concurrent retries duplicate rows; see Finding #7. |
| 21 - late scope completion overrides Back | Partially fixed | The local Back control is disabled during scope submission, but pending operations are not invalidated on app-shell navigation. A late bulk completion still redirects; see Finding #9. |
| 22 - rejected question fetch unhandled | Fixed | `api.ts:690-710` catches network/HTTP/JSON errors, and `scope-workflow.tsx:96-104` displays a typed error. |

## Findings

### P0 -- Critical

| # | File | Issue | Reviewer | Confidence |
|---|---|---|---|---|
| 1 | `apps/api/app/auth.py:132` | Any valid Clerk user receives auditor-wide access | security, validator | 75 |

- **#1** - The dependency returns `sub` without checking an auditor role, organization, or server-side membership. Because sign-up is exposed and engagement listing returns every row, a newly created Clerk user can read and mutate audit data. Enforce a Clerk organization/role or an application auditor allowlist, and test a valid non-auditor token receives 403.

### P1 -- High

| # | File | Issue | Reviewer | Confidence |
|---|---|---|---|---|
| 2 | `apps/api/app/main.py:232` | Migration destroys legacy SOC2 framework associations | data-migration, validator | 100 |
| 3 | `apps/api/app/main.py:1408` | Free-text control reference remains in the system prompt | security, validator | 75 |
| 4 | `apps/api/app/services/scope_profiler.py:402` | RFI generation restores excluded ISO controls | correctness, validator | 100 |
| 5 | `apps/api/app/services/scope_profiler.py:142` | Invalid scope answers can silently under-scope PCI | correctness, validator | 100 |
| 6 | `apps/api/app/main.py:936` | Re-scoping retains removed analyzer frameworks | adversarial, validator | 100 |
| 7 | `apps/api/app/main.py:576` | Concurrent same-key retries bypass idempotency | adversarial, api-contract, reliability, validator | 100 |
| 8 | `apps/api/app/auth.py:64` | JWKS outage returns a 500 rather than typed auth-unavailable response | reliability, validator | 100 |
| 9 | `apps/web/src/components/scope/scope-workflow.tsx:255` | A late bulk completion overrides app-shell navigation | julik-frontend-races, validator | 100 |
| 10 | `apps/web/src/components/scope/scope-workflow.tsx:320` | Scope answers remain editable after submit snapshots them | julik-frontend-races, validator | 100 |

- **#2** - The atomic SOC2 migration decision is not implemented atomically for existing data. Preserve/archive old rows until an approved migration has a replacement policy and verification query.
- **#3** - This is only defense in depth, not an instruction/data boundary. Reject unmatched controls for control-aware analysis, or omit arbitrary control text from the model's system message.
- **#4** - For fully remote ISO scope, `physical_security_docs` is retained because some of its 14 targets remain applicable, then `generate_rfi` emits all 14. Filter each retained item's `maps_to` against excluded IDs before persistence and test the generated RFI set.
- **#5** - Presence-only validation accepts `""` or an arbitrary string for `PCI.SCP.2`; the exclusion function treats it as no e-commerce. Validate question IDs, types, and allowed option values at the API boundary.
- **#6** - A second scope submission replaces the checklist but only inserts selected frameworks. Delete/replace the engagement's scope-managed framework set transactionally, or make analysis read the persisted scope set directly.
- **#7** - Two requests can both see no key, insert rows, then one loses only the final `ON CONFLICT DO NOTHING`. Reserve the key before inserts, with an in-progress/result state, and add a concurrent test.
- **#8** - `httpx` transport, status, and JSON errors are neither `AuthConfigurationError` nor `PyJWTError`, so FastAPI exposes an internal error. Convert them to a fail-closed 503 and test timeout/non-2xx/malformed JWKS paths.
- **#9** - The local Back button is disabled, but the sidebar is not. Navigating to Evidence during bulk creation is followed by the stale callback's `router.refresh()` and `router.push()` to Requests. Invalidate on unmount/route departure or abort the request.
- **#10** - The submit handler passes the current `answers` before awaiting, while question inputs stay enabled. The user can change the displayed answer while the backend persists the old snapshot. Disable all question controls while pending.

### P2 -- Moderate

| # | File | Issue | Reviewer | Confidence |
|---|---|---|---|---|
| 11 | `apps/web/src/lib/api.ts:441` | Public UI says a failed pre-upload extraction was received | adversarial, api-contract | 100 |
| 12 | `apps/api/tests/test_api_endpoints.py:90` | Auth test coverage can miss removed protection on sensitive routes | testing | 100 |

- **#11** - Extraction now fails before storage at `main.py:1144-1157`, but the client treats `Failed to extract PDF text` as received. The stakeholder can be told the auditor will see a file that does not exist. Return `received: false` for this failure.
- **#12** - The unauthenticated test list contains only `/engagements`; deleting auth from scope, bulk RFI, analyze, review, or preview routes would still pass. Parameterize the protected route inventory.

## Verification

- `uv run pytest tests/test_auth.py tests/test_scope_profiler.py tests/test_api_endpoints.py -q` from `apps/api`: `21 passed, 1 skipped`. The Postgres-dependent endpoint module was skipped in this environment, so the claimed 34-test result was not independently reproduced.
- `npx tsc --noEmit` from `apps/web`: passed.
- `npm run build`: compiled successfully when the configured Google Font could be fetched. The sandbox-only first attempt failed at that external font fetch.
- `npm run lint`: failed at the pre-existing `apps/web/src/components/review/review-panel.tsx:135` React `set-state-in-effect` rule. `git blame` attributes the line to `db836c3`, but the PR's claim that lint is clean is not reproducible.
- `git diff --check 02475be`: failed on whitespace records in `apps/api/tests/fixtures/seed_evidence/pdfs/nist_de_cm_01_partial_branch_monitoring_gap.pdf`. The file remains a valid one-page PDF, but the claimed clean diff check is not reproducible.

## Overall verdict

> Not ready to push to `origin` or request human review.
>
> The PR fixes important behavior, including signature/issuer/expiry JWT checks, blank/malformed AI-result rejection, single-control RFIs, and most scope/UI failure handling. But it still permits unrestricted Clerk users to act as auditors, exposes a request-ID-only public upload mutation, deletes legacy SOC2 associations, and can generate requests for controls that scope explicitly excluded.
>
> Fix order: #1 and the upload-token boundary -> #2 -> #4 through #7 -> #8 through #10. Re-run database-backed API tests, add focused frontend async tests, then repeat lint and `git diff --check`.

## New issues introduced or newly exposed by this PR

- Public upload credential bypass: `main.py:1133-1182` keeps the upload mutation public but binds it only to `request_id`, despite the magic-link design using `token` as the credential in `upload_lookup.py:105-110`. This is the missing token-scoped half of the upload decision and is release-blocking.
- Audit-trail actor remains caller-controlled: the PR adds `auditor_id` to `submit_decision` at `main.py:696-698`, but persists `payload.decided_by` at `:712` and `:718`. An authenticated user can forge the displayed decision actor. Bind the stored actor to the verified subject and resolve display names server-side.
