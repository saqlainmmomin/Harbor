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
