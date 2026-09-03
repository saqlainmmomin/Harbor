# Codex: generate seed evidence documents with deliberate gaps

## Goal

Generate a set of realistic-looking PDF evidence documents — some fully compliant, some with
specific, deliberate gaps — to use as test fixtures for `ai_audit_copilot`'s new control-aware
analysis endpoint (`POST /evidence-files/{file_id}/analyze`). The point is to have a corpus where
we *know* the ground truth for each document (fully met / partially met / not met, and exactly
why), so we can upload each one, run analyze, and check whether Groq's real verdict matches what
we planted — not just that the endpoint returns *something* plausible-sounding. Definition of
done: a folder of PDFs plus a manifest mapping each PDF to its target control ID, its intended
ground-truth verdict, and the specific gap it was built to contain (if any) — see Report back.

This is a fresh, independent task from the scope/RFI/analyze implementation work itself — you do
not need to review or understand the backend/frontend code in depth, just the shape of what the
analyze endpoint expects and returns, and the control library it checks documents against.

## Current state

- Repo: `/Users/saqlainmomin/ai_audit_copilot` (or the `harbor` remote —
  `https://github.com/saqlainmmomin/Harbor.git` — `main` branch has the finished backend).
- The analyze endpoint takes one uploaded PDF and one control (resolved from the evidence
  request's `control_ref`), sends the PDF's extracted text + that control's title/description to
  Groq, and gets back `compliance_status` (`compliant`/`partially_compliant`/`non_compliant`/
  `not_assessed`), `current_state`, `gap_description`, `evidence_quote`, `risk_level`, and
  `follow_up_evidence` (what to collect next). Full endpoint behavior and prompt structure:
  `tasks/handoffs/2026-09-03-backend-scope-rfi-analysis.md`, section 4 ("Decouple + control-aware
  analysis") — read this to understand what the model is actually being asked to judge.
- Real, already-ported control definitions (the pool to pick target controls from):
  `apps/api/app/frameworks/definitions/iso27001.py`, `nist_csf.py`, `pci_dss.py`. Each `Control`
  has an `id`, `title`, `description`, and `reference` — use these directly rather than
  reinventing control language, so a document you build to satisfy "A.5.1 Information Security
  Policy" actually addresses what that control's real `description` field asks for.
- No existing seed-document generation exists in this repo — `apps/api/seed.py` seeds database
  rows (engagements, stakeholders, requests), not files. You're building something new.

## Key files

- `apps/api/app/frameworks/definitions/iso27001.py` — pick ~4-5 target controls from here for the
  first pass (mix of a policy-type control, a technical-control, and one with clear
  sub-requirements you can partially satisfy).
- `apps/api/app/frameworks/schema.py` — the `Control` dataclass shape (`id`, `title`,
  `description`, `reference`, `tags`) so you know exactly what fields exist to write against.
- `tasks/handoffs/2026-09-03-backend-scope-rfi-analysis.md` — analyze endpoint spec + the real
  Groq call the backend session made during its own verification (search for `"analyze"` in its
  `## Results` section) — useful as a calibration example of what a real response looks like for
  one already-known case.

## Constraints

- Documents must be **plausible business documents**, not obviously synthetic test fixtures with
  giant "THIS IS A GAP" markers — the point is to test whether the model can actually find real
  gaps in realistic prose, not whether it can find an intentionally flagged marker. Write them the
  way a real company's policy/procedure/log document would actually read.
- Cover at least these three ground-truth categories, with at least 2 documents each:
  1. **Fully compliant** — genuinely satisfies the target control's real requirements.
  2. **Partially compliant** — satisfies most of the control but is missing one specific,
     identifiable element (e.g. a policy that covers everything except review/update cadence; an
     access-log that shows quarterly reviews happening but no evidence of revocation
     follow-through).
  3. **Non-compliant / off-target** — either addresses a different topic entirely, or is a
     template with unfilled placeholders (the existing codebase's upload pipeline already has a
     placeholder-detection floor for this exact case — see `README.md`'s "code-based floor" bullet
     under "Evidence upload" — worth deliberately testing that this floor and the new analyze
     endpoint agree, or at least don't contradict each other).
- Each document needs a manifest entry (see Report back) stating *exactly* what gap you planted
  and why, written *before* you run it through analyze — don't reverse-engineer the "intended"
  gap from whatever Groq happens to say, that defeats the point of having ground truth.
- Output PDFs somewhere clearly separate from real app code, e.g.
  `apps/api/tests/fixtures/seed_evidence/` (create if it doesn't exist) — do not touch
  `apps/api/seed.py` or any real database-seeding logic.
- Don't upload these through the running API or touch any real database as part of *generating*
  them — that's a separate verification step for whoever consumes this fixture set next (possibly
  you, possibly another session), and should happen only after the manifest is written.

## What to build

1. Pick 4–5 target controls across the three frameworks (don't limit to just ISO) — read their
   real `description` text first.
2. For each target control, write 2–3 short (roughly half a page to one page) documents in the
   three ground-truth categories above. Vary the framing across the set — not every "partial" gap
   should be the same kind of gap (missing cadence vs. missing scope vs. missing an owner/approver
   vs. stale date).
3. Render each as an actual PDF (any straightforward method — a Python script using `reportlab`
   or similar, or converting from Markdown/HTML — whatever's simplest and already available; don't
   add a new heavyweight dependency to the main app's `requirements.txt` for this, keep any script
   you write self-contained under the fixtures folder or a scratch location).
4. Write the manifest (JSON or Markdown, your choice) with one entry per document:
   `{"file": "...", "target_control_id": "...", "framework": "...", "ground_truth_status":
   "compliant|partially_compliant|non_compliant", "planted_gap": "<specific description, or null
   for fully-compliant docs>"}`.

## Verification

You don't have credentials to hit real Groq/Supabase, so full end-to-end verification (upload →
analyze → compare to manifest) is **out of scope for you** — leave that to whoever runs this
fixture set against the live endpoint next. Instead:

- Confirm every PDF actually contains extractable text (open each with `pypdf` — the same library
  the app itself uses — and print the extracted text length; a scanned-image PDF with no text
  layer would silently fail the app's own extraction, so catch that here rather than downstream).
- Spot-check 2–3 documents by reading the extracted text yourself and confirming it plausibly
  reads the way you intended (a fully-compliant doc reads as fully compliant, etc.) — this is a
  sanity check on your own writing, not on the model.
- List the final file tree and manifest contents in your report.

## Report back

Append a `## Results` section to this file with: the final list of target controls chosen (with
reasoning for the mix), the full manifest, the file tree under the fixtures folder, and the
extractable-text spot checks from Verification above. Note explicitly that upload/analyze
end-to-end verification against the real backend was left for a follow-up pass, since you didn't
have live credentials.
