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
