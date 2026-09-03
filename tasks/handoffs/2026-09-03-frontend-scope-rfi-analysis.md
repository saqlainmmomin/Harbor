# Frontend: scope UI, RFI review screen, control-aware Analyze button

## Goal

Add the auditor-facing UI for a new scope → RFI workflow to `ai_audit_copilot`'s Next.js app
(`apps/web`), and replace the review panel's automatic AI summary with an explicit,
control-aware "Analyze" action. Definition of done:

- An auditor can pick framework(s) for an engagement, answer scope questions, and see a
  generated evidence checklist.
- From that checklist, the auditor gets an editable draft list of RFI items (title,
  description, control, stakeholder, due date — editable and removable, plus the ability to
  add manual rows), and can submit it to create real evidence requests in one action.
- The request review panel shows a file's evidence with a manual "Analyze" button (not an
  automatic result) that, once clicked, renders a real control-status verdict — met / partial /
  not met, a quoted excerpt, the gap, and concrete follow-up evidence to collect — instead of
  the old generic document summary.
- Everything is verified by actually running the app in a browser and clicking through the flow
  before you report done (see Verification) — do not report success from reading code alone.

This is the frontend half of a two-session split. A separate backend session is building the
API endpoints this UI calls. **The backend session may still be in progress or may have
deviated from the contract below** — before you start, check whether
`tasks/handoffs/2026-09-03-backend-scope-rfi-analysis.md` has a `## Results` section; if it
does, its contract deviations (if any) are authoritative over the contract copied below. If
the backend endpoints aren't up yet, build against the contract below and mock responses
locally so you're not blocked, but call this out clearly in your own Results section.

## Current state

- Repo: `/Users/saqlainmomin/ai_audit_copilot`, branch `main`. Work in your own git worktree
  (e.g. `git worktree add ../ai-audit-copilot-frontend -b frontend/scope-rfi-analysis`) so you
  don't collide with the backend session or the user's own working tree.
- The full architecture/product context and the approved plan live at
  `/Users/saqlainmomin/.claude/plans/zany-gliding-catmull.md` — **read this first**.
- Nothing has been built on the frontend side yet for this feature. The existing app (auth,
  dashboard, requests table, review panel, stakeholder upload) is fully working and described
  below only where you need to touch or extend it.

## Key files

- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/lib/api.ts` — every backend call goes
  through here today (e.g. `createEvidenceRequest`, `uploadEvidenceFile`, `submitDecision`,
  `fetchEvidenceReview`). Add new functions here for the new endpoints — follow its existing
  pattern (fetch wrapper, `{ok, ...}` or `{ok:false, message}` return shape — read a couple of
  existing functions in this file before adding yours, match their error handling exactly).
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/lib/types.ts` — shared types mirroring the
  Postgres schema (per its own header comment). Add types for scope answers, evidence checklist
  items, RFI draft items, and the new analyze-response shape here.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/lib/config.ts` — has
  `DEFAULT_ENGAGEMENT_ID`; this is currently a single-engagement prototype, don't build
  multi-engagement selection.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/components/requests/new-request-form.tsx`
  — the existing single-item request creation form. Reuse its field components
  (`FormField` from `apps/web/src/components/requests/add-stakeholder-form.tsx`) and its
  input styling for your new draft-RFI-row editor — don't invent new form primitives.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/components/review/review-panel.tsx` — the
  file you're editing for the Analyze button. Read it in full; it currently assumes
  `request.ai_review` is populated automatically and renders `completeness`/`summary`/
  `suggested_controls`/`flags`/`excerpts`. You're changing what's rendered when a review exists,
  and adding the trigger to create one.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/components/upload/request-upload.tsx` —
  the stakeholder-facing public upload page. **Do not touch this file** — analysis was never the
  stakeholder's concern and stays that way.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/lib/request-status.ts` — shared status/
  count logic. You likely don't need to change this; the existing `RequestStatus` values
  (`not_sent`/`awaiting_upload`/`pending_review`/etc.) still cover the new flow, since analysis
  moves the request to `pending_review` same as before, just from a different trigger.
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/src/app/(auth)/engagements/[engagementId]/`
  — route structure to follow for new pages (e.g. a new `scope/page.tsx` and
  `requests/generate/page.tsx`, or fold both into one flow — your call on routing, just follow
  the existing route-group/layout conventions in this directory).
- `/Users/saqlainmomin/ai_audit_copilot/apps/web/AGENTS.md` — **read this before writing any
  Next.js code.** This repo pins a Next.js version with breaking API changes from what your
  training data knows; it points you at `node_modules/next/dist/docs/` for the real current
  APIs. Do not assume standard Next.js conventions without checking.

## Constraints

- Match the existing visual language exactly: CSS variables (`var(--surface)`, `var(--border)`,
  `var(--ink)`, `var(--accent)`, etc.), the same rounded-corner/spacing scale, the same button
  and form-field styling already used in `new-request-form.tsx` and `review-panel.tsx`. Do not
  introduce a new design system or new CSS variables.
- Do not touch: Clerk auth/layout, the stakeholder upload flow, the decision buttons
  (approve/reject/request more) or their persistence, the activity feed, the dashboard, the
  landing page. These are explicitly out of scope per the plan.
- The review panel's "Analyze" button replaces the assumption that `request.ai_review` appears
  automatically after upload — it does not anymore (the backend session is removing the
  automatic call). Handle the state where a file has been uploaded but never analyzed
  (show the button, no review yet) distinctly from "analysis is running" and "analysis
  complete."
- `control_ref` stays free text everywhere in the UI (an editable input, not a dropdown tied to
  the framework library) — matching `new-request-form.tsx`'s existing `Control` field. The
  scope/RFI-generation flow pre-fills it, but the auditor can always overwrite it.
- No SOC 2 anywhere in copy, types, or the framework picker — the three frameworks are
  ISO 27001, NIST CSF, and PCI-DSS (check the backend handoff's Results section for the exact
  string values it registered under `VALID_FRAMEWORKS`, likely `ISO27001`/`NIST_CSF`/`PCI_DSS`
  — use those exact strings, don't invent your own).

## What to build

1. **API client functions** in `lib/api.ts` (and types in `lib/types.ts`):
   - `fetchScopeQuestions(frameworkId: string)`
   - `submitEngagementScope(engagementId, frameworks, scopeAnswers)`
   - `fetchEngagementScope(engagementId)` (for re-visiting the page after scope was already run)
   - `generateRfiDraft(engagementId)`
   - `bulkCreateEvidenceRequests(engagementId, items)`
   - `analyzeEvidenceFile(fileId)`

2. **Scope step UI**: a page/section where the auditor picks one or more of the three
   frameworks, then answers that framework's scope questions (render from
   `ScopeQuestion.type` — `single_select`/`multi_select` — using its `options`), submits, and
   sees the resulting evidence checklist (grouped by document, showing which controls each item
   maps to and why it's required/recommended). This checklist view is a stepping stone to RFI
   generation below, not necessarily a separate persisted page — your call on whether scope
   answering and checklist review are one screen or two, but the flow must let the auditor see
   the checklist before generating the RFI (don't auto-generate RFI items the auditor never
   saw).

3. **RFI draft/review screen**: call `generateRfiDraft`, render one editable row per draft item
   — title, description, control (all editable text/textarea, matching `new-request-form.tsx`
   styling), a stakeholder dropdown (reuse the pattern from `new-request-form.tsx`'s `Owner`
   field — you'll need the engagement's stakeholder list, already available via the existing
   `fetchStakeholders`-equivalent call in `api.ts`, check what's already there), and a due-date
   input. Support removing a row and adding a manual row (blank row with the same fields).
   Submit button calls `bulkCreateEvidenceRequests` with the edited list, then routes to the
   engagement's requests page on success (`router.refresh()` + navigate, matching the pattern in
   `new-request-form.tsx`'s `handleSubmit`).

4. **Review panel Analyze button** in `review-panel.tsx`:
   - Add an `analysisState: "idle" | "analyzing" | "done" | "error"` alongside the existing
     `uploadState`/`decisionState` local state.
   - Show an "Analyze" button when `activeFile` is set and there's no review yet for that file
     (or allow re-analyze — your call, but if you allow it, make clear in the UI that
     re-running replaces the prior result, matching the existing "Recording a new decision
     replaces the one above" pattern already used for decisions in this same file).
   - On click, call `analyzeEvidenceFile(activeFile.id)`, show a loading state, then
     `router.refresh()` on success (same pattern as `handleFileSelected`/`handleDecision`
     already in this file) so the real persisted result renders server-side.
   - Replace the "AI analysis" section's rendered fields: instead of
     `completeness`/`summary`/`suggested_controls`/`flags`/`excerpts`, render
     `compliance_status` (as a clear met/partial/not-met badge — reuse `CompletenessBadge`'s
     visual pattern from `apps/web/src/components/badges.tsx` if it fits, or add an equivalent
     badge following its style), `current_state`, `gap_description`, `evidence_quote` (styled
     like the existing "Source excerpts" block — quoted, monospace location if available), and
     the new `follow_up_evidence` field, labeled clearly as "What to collect next" or similar —
     this is the field the auditor most needs, don't bury it.
   - Update `AiReview`/`SuggestedControl`-adjacent types in `lib/types.ts` to match the new
     response shape from `analyzeEvidenceFile` (see contract below) — keep the old fields
     optional/nullable rather than deleting them outright, in case any other view still
     references them (grep for `ai_review\.` across `apps/web/src` before removing a field to
     confirm nothing else reads it).

## API contract (from the backend handoff — verify against its Results section before relying on this)

```
GET  /frameworks/{framework_id}/scope-questions
  -> { "framework_id": str, "questions": [{"id", "question", "help_text", "type", "options"}] }

POST /engagements/{id}/scope
  body: { "frameworks": ["ISO27001"|"NIST_CSF"|"PCI_DSS", ...],
          "scope_answers": { "<FRAMEWORK>": { "<question_id>": "<answer_value>", ... }, ... } }
  -> { "applicable_controls": [...], "excluded_controls": [{"id","reason"}],
       "evidence_checklist": [{"document_type","label","reason","required","maps_to"}] }

GET  /engagements/{id}/scope
  -> same shape as POST response, or 404 if not yet run

POST /engagements/{id}/generate-rfi
  -> { "items": [{"control_ref","title","description","due_date": null}] }

POST /engagements/{id}/evidence-requests/bulk
  body: { "items": [{"stakeholder_id","control_ref","title","description","due_date"}] }
  -> { "created": [{"id", ...same as single-create response...}] }

POST /evidence-files/{file_id}/analyze
  -> { "id", "compliance_status", "current_state", "gap_description", "evidence_quote",
       "risk_level", "follow_up_evidence", "control_id_matched": str | null }
```

## Verification

Before reporting done — use the Browser pane (`preview_start` against `apps/web`'s dev server,
with the backend API running too), not just a read of your own code:

1. Load the engagement dashboard, navigate to your new scope step, pick a framework, answer its
   scope questions, submit, confirm a real (non-empty) evidence checklist renders.
2. Generate the RFI draft, edit a row's title, remove a row, add a manual row, assign
   stakeholders to each remaining row, submit, confirm you land on a requests list that now
   shows the newly created requests (check via the existing requests table, not just the
   success toast).
3. Open one of those requests, upload a PDF (via the existing auditor upload button in the
   review panel, no need to go through the stakeholder magic-link path for this check), confirm
   no AI review appears automatically, click Analyze, confirm a loading state appears, then a
   real result renders with a non-empty `compliance_status` and `follow_up_evidence` — not
   placeholder text.
4. Check `read_console_messages`/`read_network_requests` for errors during the above; fix any
   before reporting done.
5. Paste a screenshot (via the Browser pane's screenshot capability) or the real rendered text
   content into the Results section below, not a description of what you expect it to look
   like.

## Report back

Append a `## Results` section to this file with: what you built, any contract deviations you
had to make (and why — especially if the backend session's actual contract differed from the
copy above), the verification steps you actually ran with real output/screenshots, and anything
you deliberately left out of scope.

## Results

**Status: code complete, fully verified against the real running backend (real Postgres, real
Groq, real Supabase) — not mocks.** The backend session finished first (its own `## Results`
section, above, was already present when this session started) and its server was runnable, so
nothing here was built against mocked responses.

### Worktree

Worked directly in the harness-provided isolated worktree
(`/Users/saqlainmomin/ai_audit_copilot/.claude/worktrees/agent-a838063255bf3532c`) rather than
creating a second `git worktree add` — the harness had already put this session in its own
worktree/branch (`worktree-agent-a838063255bf3532c`), which satisfies the same isolation goal.
Not committed (per "only commit when the user explicitly asks").

### What was built

1. **API client functions** in `apps/web/src/lib/api.ts`: `fetchScopeQuestions`,
   `submitEngagementScope`, `fetchEngagementScope`, `generateRfiDraft`,
   `bulkCreateEvidenceRequests`, `analyzeEvidenceFile` — all following the existing
   fetch-wrapper / `{ok,...}` or `{ok:false,message}` pattern, `errorMessage` helper reused as-is.
2. **Types** in `apps/web/src/lib/types.ts`: `ScopeFramework` (`ISO27001`/`NIST_CSF`/`PCI_DSS`,
   kept deliberately separate from the existing `Framework` type used by engagement creation —
   see deviation #1 below), `ScopeQuestion`/`ScopeQuestionOption`, `EngagementScope`,
   `ExcludedControl`, `EvidenceChecklistItem`, `ScopeAnswers`, `RfiDraftItem`/`RfiDraftRow`, and
   new optional fields on `AiReview` (`compliance_status`, `current_state`, `gap_description`,
   `evidence_quote`, `risk_level`, `follow_up_evidence`, `control_id_matched`) — old fields kept,
   not deleted, per the constraint.
3. **Scope step UI**: `apps/web/src/app/(auth)/engagements/[engagementId]/scope/page.tsx` (server
   component, fetches engagement/existing-scope/stakeholders) +
   `apps/web/src/components/scope/scope-workflow.tsx` (client component, one screen, 4 steps:
   Frameworks → Scope questions → Checklist → RFI draft, with a step indicator). Re-visiting an
   engagement that already has a computed scope skips straight to the checklist step. Added a
   "Scope & RFI" sidebar nav item in `apps/web/src/components/app-shell.tsx`.
4. **RFI draft/review screen**: part of the same `scope-workflow.tsx` (step 4) — editable
   title/description/control (text/textarea), a stakeholder `<select>` (reusing
   `fetchEngagementStakeholders`, already in `api.ts`), a due-date input, remove-row and
   add-manual-row, bulk submit via `bulkCreateEvidenceRequests` then `router.refresh()` +
   `router.push` to the requests list — matching `new-request-form.tsx`'s pattern exactly. Reused
   `FormField` from `add-stakeholder-form.tsx` throughout, no new form primitives.
5. **Review panel Analyze button** in `apps/web/src/components/review/review-panel.tsx`:
   `analysisState`/`analysisError` local state, an "Analyze" button shown when a file is selected
   and has no review yet for that file, a "Re-analyze" button (with a "Re-running replaces the
   result above" tooltip, matching the existing decision-replacement copy pattern) when one
   exists. New rendering: `ComplianceStatusBadge` (new component in `badges.tsx`, same visual
   pattern as `CompletenessBadge`) showing met/partially met/not met, `current_state`,
   `gap_description`, `evidence_quote` (styled like the old "Source excerpts" block), and
   `follow_up_evidence` in a visually distinct amber "What to collect next" block (the field
   auditors most need, not buried). Old fields (`doc_type`/`summary`/`suggested_controls`/
   `flags`/`excerpts`) still render as a fallback for any review that genuinely has no
   `compliance_status` (legacy/mock-data path) — grepped `ai_review\.` across `apps/web/src`
   first (`request-status.ts`, `requests-table.tsx`, `overview-dashboard.tsx`,
   `findings-list.tsx`, `evidence-files-table.tsx`) and kept those fields populated with
   sensible derived values (`compliance_status` → `completeness`, `gap_description` → a flag,
   `evidence_quote` → an excerpt) so none of those other views silently break or go blank.

### Contract deviations (found by actually running the backend, not assumed)

1. **`Framework` vs `ScopeFramework`**: did not touch the existing `Framework` type
   (`SOC2`/`ISO27001`, used by `new-engagement-form.tsx`/engagement creation) — out of scope per
   the handoff, and the backend's own frameworks (`ISO27001`/`NIST_CSF`/`PCI_DSS`, confirmed via
   real `VALID_FRAMEWORKS` rejection of `"SOC2"` — see verification below) are a different set
   used only by the new scope questionnaire. Added a separate `ScopeFramework` type instead of
   overloading the existing one, to avoid touching the engagement-creation flow at all.
2. **GET `/evidence-requests/{id}/review` does not surface the new `ai_reviews` columns** — this
   is the significant one, found only by actually clicking Analyze and reloading the page. The
   frontend handoff's contract only specified `POST /evidence-files/{id}/analyze`'s response
   shape; it didn't specify (and I'd wrongly assumed) that `GET .../review` would also return
   `compliance_status`/`current_state`/`gap_description`/`evidence_quote`/`risk_level`/
   `follow_up_evidence` as top-level fields once persisted. Verified against the real backend
   (`curl http://localhost:8000/evidence-requests/{id}/review` after a real Analyze) that those
   columns come back `null` — the real values only exist as a JSON string inside
   `ai_review.raw_response.text` (Groq's raw response body). Fixed on the frontend side, two ways,
   without touching the backend:
   - `analyzeEvidenceFile` now parses and returns the full `POST /analyze` response body (not just
     `{ok:true}`), and `review-panel.tsx` renders that directly (`freshReview` state) instead of
     depending solely on the `router.refresh()` round-trip — so the button click's own result is
     never lost.
   - `mapWireAiReviewInner` in `api.ts` now also best-effort parses `raw_response.text` as a
     fallback source for the same six fields when the dedicated columns are null (helper
     `parseRawAnalyzeText`) — so a **fresh page load** (no client state at all) of a request that
     was analyzed earlier still renders the real control-aware verdict, not the generic fallback.
     Verified this specifically: navigated fresh (not via the Analyze click) to a previously
     analyzed request and confirmed the real fields render (see verification step 4 below).

### Verification — real output, real backend, real Groq

1. **Backend**: the backend session's own server wasn't running when this session started (no
   `uvicorn` process). Restarted it myself against the real `.env` that has real
   `GROQ_API_KEY`/`SUPABASE_*` values (`/Users/saqlainmomin/ai-audit-copilot-backend/apps/api/.env`
   — these were placeholders when the backend session wrote its Results section but had since
   been filled in with real values). `curl http://localhost:8000/health` → `{"status":"ok"}`.
2. **Auth**: the app requires Clerk. No `.env.local` existed for `apps/web`; ran
   `npx clerk@latest init` (keyless dev instance) to get real publishable/secret keys. Sign-up hit
   a Cloudflare Turnstile bot-check that fails to render inside this environment's browser pane
   ("CAPTCHA failed to load — unsupported browser or extension"). Per instruction from the
   coordinator, used Clerk's officially-supported test path instead of trying to click through it:
   created a real user via the Clerk Backend API (`POST /v1/users`, `email_address:
   ["auditor+clerk_test@example.com"]`) and signed in through the real `/sign-in` UI in the
   browser pane using that email + password; the `+clerk_test` convention makes Clerk accept the
   fixed test code `424242` for the new-device email verification step — no CAPTCHA involved
   anywhere in this path, and it exercises the real sign-in UI, not a bypass of the app itself.
3. **CORS**: `apps/api`'s `FRONTEND_ORIGIN` defaults to `http://localhost:3000`; ran the frontend
   dev server on port 3000 (not an arbitrary port) so the scope step's client-side fetches
   (`fetchScopeQuestions`) aren't blocked — first attempt on port 3200 hit a real
   `TypeError: Failed to fetch` from CORS rejection, confirming this matters.
4. **Full click-through, real output**:
   - Loaded `/engagements/eng_001`, navigated to Scope & RFI, selected ISO 27001 + NIST CSF,
     answered all 7 real scope questions (`GET /frameworks/iso27001/scope-questions` returned 4
     real ISO questions with real control references like `A.5.23`, `A.8.25-A.8.34`; NIST CSF
     returned tier/OT/profile questions) — confirmed via `read_page` that framework selection was
     multi-select and both frameworks' question sets rendered together.
   - Submitted scope (`POST /engagements/eng_001/scope`) → real non-empty `evidence_checklist`
     rendered (screenshot: "Cybersecurity Governance Charter / Strategy — Required — Assessed
     against the Govern function (GV.OC, GV.RM, GV.PO) — Maps to: NIST.GV.OC.01, ..."), and a real
     `excluded_controls` entry rendered: **"ISO.A5.23 — Cloud services: not used"** — confirms the
     answered "No" to the cloud-services question correctly excluded exactly the cloud-gated
     control, matching the backend's own independent verification of the same exclusion logic.
   - Generated the RFI draft (`POST /engagements/eng_001/generate-rfi`) → 16 real draft items
     rendered, each with real `control_ref`/title/description pulled from the checklist. Edited
     row 1's title to "Information Security Policy (edited by auditor)" (confirmed via
     `read_page` the edit persisted), removed 13 rows down to 3, added 1 manual row
     (`control_ref: "A.9.4"`, title "Manual RFI: Privileged Access Log"), assigned a real
     stakeholder (added "Priya Anand" via the existing Add Stakeholder form first, since `eng_001`
     had none), filled real due dates.
   - Submitted (`POST /engagements/eng_001/evidence-requests/bulk`) → **201 Created**. Confirmed
     via `curl http://localhost:8000/engagements/eng_001/evidence-requests` that all 4 requests
     landed with the exact edited/manual content:
     ```json
     {"id":"req_8e99e...","control_ref":"ISO.A5.1","title":"Information Security Policy (edited by auditor)","status":"not_sent","due_date":"2027-03-31", ...}
     {"id":"req_926c3...","control_ref":"ISO.A5.15, ISO.A5.16, ISO.A5.17, ISO.A5.18","title":"Access Control Policy", ...}
     {"id":"req_2dba8...","control_ref":"ISO.A5.7","title":"Information Security Risk Assessment", ...}
     {"id":"req_0458b...","control_ref":"A.9.4","title":"Manual RFI: Privileged Access Log","description":"Manually added by auditor -- request the Q3 privileged access log.","due_date":"2027-05-01", ...}
     ```
     and confirmed via the real Requests page (not just the toast) — table showed "All 5" (1 seed
     + 4 new), including the manual row.
   - Uploaded a real PDF (`POST /evidence-requests/{id}/upload`, a synthetic-but-realistic
     "Privileged Access Review Log" PDF built for this test, real extractable text verified with
     the backend's own `pypdf`) to the manual-row request. Confirmed via
     `curl .../evidence-requests/{id}/review` → `"ai_review": null` — **no automatic AI review
     fired on upload**, matching the backend's decoupling. Reloaded the request page in the
     browser: file listed as **"Not analysed"**, and the review section showed **"Not analyzed
     yet"** with a manual **Analyze** button — no automatic result appeared anywhere.
   - Clicked **Analyze**. `POST /evidence-files/{id}/analyze` → **200 OK**, real Groq call (model
     `openai/gpt-oss-120b`), real non-placeholder result rendered immediately:
     ```json
     {"compliance_status":"compliant","current_state":"The organization performs quarterly privileged (admin/root) account reviews on production systems, revokes unused accounts, and records sign-off in an access-review log.","gap_description":"No gap identified.","evidence_quote":"Privileged account access is reviewed quarterly by the security team and sign-off is recorded in the access review log.","risk_level":"low","follow_up_evidence":"None"}
     ```
     UI showed: Control status badge "Met" (green), Risk level "Low", Current state and Source
     excerpt (quoted, exact text above), "What to collect next: None" in the amber callout, and
     the request status badge flipped to "Needs your review" (`pending_review`) — same trigger the
     old auto-review used to cause, now from the explicit click.
   - **Fallback path**: uploaded the same PDF to a second request whose `control_ref` is a
     comma-joined multi-control string (`"ISO.A5.15, ISO.A5.16, ISO.A5.17, ISO.A5.18"`, unlikely
     to resolve via `FrameworkDefinition.get_control`) and analyzed it. Real result, `HTTP 200`,
     `"control_id_matched": null` — confirms the generic-fallback path works and doesn't 500.
     Follow-up evidence for this one: `"No additional evidence required; maintain quarterly logs
     and reviewer sign-off."` — a different, specific, non-templated string, confirming this isn't
     a canned response.
   - **Reload persistence check** (this is what surfaced deviation #2 above): navigated fresh
     (full page load, no client state) to the already-analyzed multi-control request. Before the
     `raw_response.text` fallback fix, this rendered the generic legacy fallback (Assessed
     completeness: Insufficient / Unclassified document / No controls mapped) even though a real
     control-aware review existed — a real bug, not a hypothetical. After the fix: fresh load
     correctly rendered "Control status: Met", "Risk level: Low", the real current-state text, the
     real quoted excerpt, and the real "What to collect next" text shown above — confirmed via
     screenshot in the browser pane, not just the API response.
5. **Console/network**: `read_console_messages` → no errors at any point in the flow.
   `read_network_requests` → every request `200`/`201` except the two transient issues fixed
   during verification (CORS on the wrong port; the pre-existing-server-not-running gap) — both
   fixed before the final pass, not worked around.
6. **TypeScript/lint**: `npx tsc --noEmit` — clean (the only errors are pre-existing
   `Cannot find name 'PageProps'`/`LayoutProps'` on *every* route file including untouched ones,
   which only resolve once `next dev`/`next build` generates `.next/types` — not a real error, the
   dev server itself compiles and serves every route fine). `npx eslint` on every new/edited file
   — clean except one pre-existing warning in `review-panel.tsx` (`set-state-in-effect` in the
   existing file-preview `useEffect`, code this session didn't touch).

### Local setup notes (for reproducing this)

- Backend: `cd /Users/saqlainmomin/ai-audit-copilot-backend/apps/api && .venv/bin/uvicorn
  app.main:app --port 8000` (real `.env` already present there).
- Frontend: `.env.local` created in this worktree's `apps/web` with
  `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`, `NEXT_PUBLIC_DEFAULT_ENGAGEMENT_ID=eng_001`,
  plus the Clerk keyless-dev keys from `npx clerk@latest init` and
  `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/engagements/eng_001` (was `/`, corrected per
  the README's own note that `/` is the public landing page). Run on **port 3000** specifically
  (`npm run dev -- --port 3000`) — required for the backend's default CORS origin.
- Test login: `auditor+clerk_test@example.com` / `Aud1t0r-Pass!2026` (created via Clerk Backend
  API, real user in this keyless dev Clerk instance).

### Left out of scope (deliberately)

- Did not touch `request-upload.tsx` (stakeholder upload page), decision buttons/persistence,
  activity feed, dashboard, landing page, Clerk auth/layout — per the constraints.
- Did not add a `sendEvidenceRequest` call from the RFI bulk-create flow — bulk-created requests
  land at `not_sent` same as the existing single-create flow; sending them is a separate, already
  existing action on the Requests page, not something this feature needed to duplicate.
- Did not attempt to fix the pre-existing `set-state-in-effect` lint warning in `review-panel.tsx`
  — unrelated to this feature, not introduced by this session.
- Did not add scope-answer editing/re-running UI beyond re-visiting the same 4-step flow (re-
  submitting scope answers overwrites the persisted `engagement_scope` row, per the backend's
  upsert-only design — no versioning UI, matching "left out of scope" in the backend's own
  Results).
- The manually-authored test PDF used for upload/analyze verification is synthetic (built for
  this test, not a real client document) — noted so it's clear the *content* was fabricated for
  testing, even though the upload → extract → Groq → persist → render pipeline it exercised is
  entirely real.
