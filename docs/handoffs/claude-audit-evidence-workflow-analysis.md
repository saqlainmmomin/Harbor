---
artifact_contract: "ce-handoff/v1"
created_at: "2026-09-03T08:52:39Z"
title: "AI Audit Copilot evidence workflow analysis"
summary: "Analyze how CyberAssess scope, desk review, and RFI capabilities can extend the target evidence-collection app into a human-led design and operating-effectiveness audit workflow."
keywords: ["audit workflow", "evidence register", "desk review", "RFI", "SOC 2", "ISO 27001", "CyberAssess"]
cwd: "/Users/saqlainmomin/ai_audit_copilot"
resume_focus: "Review the current target repo and CyberAssess for reusable components, incompatibilities, technical risks, and a safe Claude/Codex implementation split after the edge cases are settled."
repository: "ai_audit_copilot"
repo_root_sha: "5844510cc561c44f90e6675384a7f07d84ca87da"
branch: "main"
head: "db836c301cfdb23396ae633ee7b91599527685e7"
worktree_path: "/Users/saqlainmomin/ai_audit_copilot"
---

# Claude handoff: AI Audit Copilot workflow analysis

## User-requested objective

Analyze the target repository and the local CyberAssess repository to determine:

1. Which existing components can be reused to add a real auditor workflow.
2. Which parts are incompatible or technically challenging.
3. What edge cases and product decisions must be resolved before implementation.
4. A later implementation split between Claude and Codex, after the user confirms the workflow contract.

Do not implement code from this handoff yet. This is a grounding and architecture-analysis handoff. Treat all recommendations below as provisional unless marked as a user requirement.

## Correct repositories

- Target app: `/Users/saqlainmomin/ai_audit_copilot`
  - Remote: `https://github.com/anushkamishra7/ai_audit_copilot.git`
  - Branch/head captured here: `main` / `db836c301cfdb23396ae633ee7b91599527685e7`
- Scope/desk-review source: `/Users/saqlainmomin/dpdpa-gap-tool`
  - Remote: `git@github.com:saqlainmmomin/Cyber.git`
  - Branch: `feat/web-portal`

Do not analyze or modify the similarly named hyphenated checkout `/Users/saqlainmomin/ai-audit-copilot`; it is not the target repository for this task.

## Desired product flow

The user wants the target app to become an auditor-facing evidence workbench:

1. Start with a small scope questionnaire, reusing CyberAssess’s scope logic, to determine the engagement scope, selected standards, applicable controls, entities/systems/processes, evidence period, and exclusions.
2. Generate a draft design-evidence RFI for policies, procedures, standards, control descriptions, and other documents required to assess control design.
3. Let the auditor approve, edit, remove, or manually add RFI items before assigning them to stakeholders and sending them.
4. Reuse the target app’s existing stakeholder assignment, magic-link upload, file storage, preview, activity, and AI triage where appropriate.
5. Treat uploaded files as evidence candidates. The auditor approves accepted evidence into an evidence register and can reject, replace, or request more evidence.
6. Run a control-aware design/desk review against the selected standard and asserted requirements. The analysis must highlight deviations and provide exact source citations, not just a generic summary.
7. Once the design is understood, generate a second proposed RFI for operating-effectiveness testing. It must describe what to verify in practice—period, population, sample, logs, tickets, approvals, configurations, and exception evidence—not simply repeat the design RFI.
8. Let the auditor approve/edit/assign the operating test requests, collect evidence, review it, record findings and exceptions, and support retest/closure.
9. Update the landing page and app positioning to describe a human-led, AI-assisted audit evidence workflow rather than a generic evidence uploader or autonomous compliance tool.

## Auditor context to preserve

The user’s Obsidian notes describe the desired working style as: read documents first, form hypotheses, ask pointed questions, probe inconsistencies, distinguish intent from practice, and use human review gates. Relevant local notes:

- `/Users/saqlainmomin/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain/01-projects/cyberassess.md:22-27` — client document/questionnaire flow and seasoned-auditor behavior.
- Same file `:64-115` — document pre-analysis, adaptive questioning, source tracking, deterministic scoring, and the rule that signals override pre-fills.
- Same file `:124-154` — adaptive question/follow-up behavior.
- Same file `:278-291` — manager review and report-release gate.
- Same file `:344-367` — prior desk-review lesson: synchronous long-running AI calls caused request holds and token truncation; background processing and output limits were used to address it.
- `/Users/saqlainmomin/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain/02-knowledge/cybersecurity/my-take-on-compliance-gaps.md:12-43` — the user’s concerns about self-attestation, static evidence, and the need to verify runtime practice.

## Current target-repo truth

Use current code over stale README claims when they disagree.

- `README.md:1-9,58-107` describes the current app as a SOC 2/ISO 27001 evidence-request dashboard with stakeholder magic links, PDF upload, pypdf extraction, Groq structured review, private Supabase storage, activity, and signed previews.
- `README.md:108-152` lists known gaps, but parts are stale: it says review decisions are not persisted, while `apps/api/app/main.py:450-502` now creates `review_decisions`, changes request status, and logs the activity.
- `apps/api/app/main.py:149-253` currently supports only `SOC2` and `ISO27001` in the engagement payload and stores engagement frameworks.
- `apps/api/app/main.py:312-432` creates evidence requests and sends magic links. The current request is tied to one stakeholder and one free-form `control_ref`.
- `apps/api/app/main.py:435-502` persists a decision, but `decided_by` is client-supplied rather than securely derived from authenticated identity.
- `apps/api/app/main.py:505-672` exposes engagement, request, evidence-file, activity, and signed-preview reads.
- `apps/api/app/main.py:745-948` accepts one PDF per call, stores it in private Supabase Storage, extracts text, sends raw text to Groq (`openai/gpt-oss-120b`), applies placeholder detection, stores `ai_reviews`, and moves the request to `pending_review`. The prompt is generic and does not currently include the control requirement, framework version, evidence period, or test objective.
- `apps/api/app/upload_lookup.py:1-225` resolves upload tokens and assembles request details; check token expiry/revocation and cross-engagement authorization before production use.
- `apps/web/src/app/(auth)/engagements/[engagementId]/requests/[requestId]/page.tsx:24-110` loads real request detail with a mock fallback for typed demo IDs.
- `apps/web/src/components/review/review-panel.tsx:245-430` already renders AI suggestions, control mapping, flags, source excerpts, preview, and auditor decisions. It is a strong UI starting point, but it currently gets only one/latest AI review and has no evidence-register acceptance state.
- `apps/web/src/components/upload/request-upload.tsx:83-177,300-328` supports multi-file stakeholder upload and partial failures, but the note field is not persisted and the backend is PDF-only.
- `apps/web/src/lib/request-status.ts:8-102` centralizes request status/count/readiness logic; extend this only after the product state machine is agreed.
- The target has no first-class Controls, Findings, Workpapers, or Reports backend entities; the disabled sidebar is intentional and should not be treated as implemented functionality.
- `SECURITY.md:40-113` documents unresolved retention, token, authorization, preview logging, and provider-copy issues. Treat it as a risk list and compare it to current code.

## Current CyberAssess truth

- `README.md:1-25,35-52` describes a FastAPI/Jinja2/HTMX multi-framework assessment tool with scope, desk review, adaptive questionnaire, two-call Claude analysis, deterministic scoring, PDF/RFI/evidence-checklist exports, and Unified Control Clusters.
- `app/services/scope_profiler.py:45-119,122-273,276-318` computes applicability, exclusions, conditional flags, and a document evidence checklist. Non-DPDPA frameworks currently pass all controls through; scope profiling is not implemented for them.
- `app/frameworks/schema.py:13-166` defines framework, domain, section, control, scope-question, and red-flag metadata. This is the strongest candidate for a normalized requirement/control contract.
- `app/services/desk_review.py:19-119,143-259` runs a Call 0 desk review, persists a document catalog, evidence map, absence findings, signal findings, coverage summary, raw AI response, and status. It clears and replaces prior findings on rerun.
- `app/dpdpa/prompts.py:213-395` requires exact quotes, locations, document cataloging, absence detection, signal detection, and structured JSON. However, the prompt explicitly says DPDPA and the service imports this DPDPA prompt directly, so this is not drop-in multi-framework desk review.
- `app/services/claude_analyzer.py:1-190` reuses desk-review evidence for later gap analysis and has document truncation, evidence extraction, framework prompts, and caching patterns.
- `app/services/question_engine.py:496-676` and `app/services/auto_answer.py` embody the valuable distinction between document intent and operational signals; preserve that behavior conceptually.
- `app/services/rfi_generator.py:35-107,192-299` generates an assessment-level RFI from gap items and desk-review absences, then asks Claude for constrained prose. It is useful for RFI language generation but not for the requested staged RFI/request lifecycle.
- `app/models/rfi.py:12-25` stores one RFI document per assessment, and `app/utils/rfi_export.py:33-176,234-346` exports PDF/DOCX. Neither represents item approval, assignment, evidence response, or versioning.
- `app/routers/web.py:102-245,302-413,419-461,1189-1294,1411-1569` contains scope, evidence checklist, document upload, assessment, and RFI UI routes that can be mined for behavior but cannot be copied directly into the Next.js target without an adapter.

## Reuse analysis to perform

Produce a table with columns: component, source path, current behavior, reuse level (`direct`, `adapt`, `inspiration`, `do not reuse`), required changes, and risk.

At minimum evaluate:

1. Target request/assignment/upload/preview/activity/decision flow.
2. CyberAssess scope profiler and framework registry/schema.
3. CyberAssess desk-review persistence and prompt structure.
4. CyberAssess evidence extraction and background/long-running AI lessons.
5. CyberAssess RFI generation and PDF/DOCX export.
6. Target request status/count logic and review UI.
7. Mock-data fallback and stale documentation—identify what must be removed or updated before real workflow work.

## Technical challenges to pressure-test

1. **Domain-model bridge:** target `engagement`/`evidence_request`/`evidence_file` versus CyberAssess `assessment`/`requirement`/`desk_review_finding`/`rfi_document`.
2. **Framework normalization:** target SOC 2/ISO 27001 versus CyberAssess’s six frameworks and DPDPA-only current desk-review prompt.
3. **Requirement provenance:** preserve framework name/version, control text, scope snapshot, and source citations across every AI run and RFI version.
4. **Evidence semantics:** separate request, file, evidence-register acceptance, requirement linkage, stage, and review conclusion; support multiple files and many-to-many links.
5. **Two-stage workflow:** prevent a design document from being mistaken for operating evidence; derive operating tests from approved design without losing auditor edits.
6. **Human gates:** generated RFI and AI findings must be editable/reviewable; no model output should directly close a control or finding.
7. **Versioning:** scope changes, new evidence, control-library updates, reruns, and model changes must create traceable versions rather than overwrite signed-off history.
8. **Async reliability:** model calls need a job/status/retry/idempotency strategy and failure recovery; do not hold browser requests open for 15–30 seconds.
9. **Security:** API authorization, engagement isolation, upload-token expiry/revocation, preview access logging, retention/deletion, and safe handling of sensitive audit documents.
10. **File processing:** decide PDF/DOCX/spreadsheet/image/OCR support and how extraction confidence affects review state.
11. **Auditor test design:** operating-effectiveness requests need period, population, sample method, expected result, exceptions, and retest—not only a document description.
12. **Product copy:** landing page language must accurately position the tool as human-led evidence review with AI assistance.

## Edge cases awaiting user decisions

Do not silently settle these. The user wants to resolve them interactively before the final plan:

- One engagement with explicit Design and Operating Effectiveness phases, or two linked engagements.
- First release limited to SOC 2/ISO 27001 or all CyberAssess frameworks.
- Treatment of uncertain scope answers and conditional controls.
- Whether every generated RFI item requires auditor approval before sending.
- Whether assignments are per RFI item, per request, or per stakeholder batch.
- Whether uploaded files are candidates until auditor acceptance into the evidence register.
- Whether evidence can be reused across requirements and across design/operating stages.
- AI suggestion-only boundary and mandatory citation requirements.
- What happens when AI is inconclusive, evidence conflicts, or the document is stale/unapproved.
- How operating test period, population, sample method, and expected result are represented.
- RFI/scope/review versioning and behavior after scope changes.
- Exception, management response, remediation evidence, retest, and accepted-risk behavior.
- Client upload behavior for additional/related files and replacement evidence.
- File formats and OCR in the first slice.

## Expected Claude output

Return analysis only—no code changes—with:

1. A reuse matrix grounded in the file pointers above.
2. A target-versus-CyberAssess domain mapping and a list of irreconcilable mismatches.
3. A risk-ranked technical challenge list, separating architectural blockers from incremental work.
4. A proposed product state machine in plain language, clearly marked as a recommendation.
5. A list of questions that must be answered by the user before implementation planning.
6. A provisional Claude/Codex split, explicitly labeled as provisional and revised after the user’s edge-case decisions.
7. A verification checklist for the eventual implementation, including AI-failure, rerun, scope-change, duplicate-upload, rejected-evidence, stale-document, token-expiry, authorization, and partial-upload cases.

Use the current target code as the source of truth when README and code disagree. Do not treat this handoff as authority to mutate either repository.
