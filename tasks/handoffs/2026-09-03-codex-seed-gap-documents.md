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


## Results

**Status: complete.** Generated 15 realistic, text-bearing PDF evidence fixtures and a JSON manifest under `/Users/saqlainmomin/ai_audit_copilot/apps/api/tests/fixtures/seed_evidence`. The generator is self-contained at `/Users/saqlainmomin/ai_audit_copilot/apps/api/tests/fixtures/seed_evidence/generate_fixtures.py`, uses the locally available `fpdf2` package, and validates every selected control against the ported framework definitions. No application code, `apps/api/seed.py`, real database, Supabase object, or running API was touched.

### Target controls

The set spans all three registered frameworks and covers policy governance, authentication, authorization, network monitoring, and audit logging. Each control has one compliant, one partially compliant, and one non-compliant/off-target document, yielding five documents per ground-truth category.

| Framework | Control | Real control requirement | Reason for inclusion |
| --- | --- | --- | --- |
| ISO27001 | `ISO.A5.1` | Policy lifecycle requirements: defined, management-approved, published, communicated, and acknowledged. | Policy control; the partial fixture isolates acknowledgement. |
| ISO27001 | `ISO.A8.5` | Secure authentication technologies and procedures tied to information-access restrictions and the access-control policy. | Technical authentication control; the partial fixture isolates weaker service-account authentication. |
| NIST_CSF | `NIST.PR.AA.05` | Access permissions must be policy-defined, managed, enforced, reviewed, least-privilege, and separated by duty. | Clear multi-part control; the partial fixture isolates emergency-access separation of duties. |
| NIST_CSF | `NIST.DE.CM.01` | Networks and network services are monitored to find potentially adverse events. | Operational monitoring control with a concrete branch-coverage boundary. |
| PCI_DSS | `PCI.10.2` | CDE audit logs support detection, alerting, and analysis, including user access and administrator actions. | Logging control with an explicit component-to-SIEM alerting gap. |

### Full manifest

Canonical file: `/Users/saqlainmomin/ai_audit_copilot/apps/api/tests/fixtures/seed_evidence/manifest.json`.

```json
[
  {
    "file": "pdfs/iso_a5_1_compliant_information_security_policy.pdf",
    "target_control_id": "ISO.A5.1",
    "framework": "ISO27001",
    "ground_truth_status": "compliant",
    "planted_gap": null,
    "document_title": "Information Security Policy Suite",
    "document_type": "Management policy",
    "control_reference": "Annex A.5.1"
  },
  {
    "file": "pdfs/iso_a5_1_partial_acknowledgement_gap.pdf",
    "target_control_id": "ISO.A5.1",
    "framework": "ISO27001",
    "ground_truth_status": "partially_compliant",
    "planted_gap": "The policy is defined, management-approved, published, and communicated, but the evidence does not show that relevant personnel and interested parties acknowledged the current version.",
    "document_title": "Information Security Policy",
    "document_type": "Management policy",
    "control_reference": "Annex A.5.1"
  },
  {
    "file": "pdfs/iso_a5_1_noncompliant_policy_template.pdf",
    "target_control_id": "ISO.A5.1",
    "framework": "ISO27001",
    "ground_truth_status": "non_compliant",
    "planted_gap": "Off-target as evidence: this is an unapproved, unfilled template with no organization-specific policy, publication record, communication record, or acknowledgement evidence.",
    "document_title": "Information Security Policy Template",
    "document_type": "Unapproved policy template",
    "control_reference": "Annex A.5.1"
  },
  {
    "file": "pdfs/iso_a8_5_compliant_authentication_standard.pdf",
    "target_control_id": "ISO.A8.5",
    "framework": "ISO27001",
    "ground_truth_status": "compliant",
    "planted_gap": null,
    "document_title": "Secure Authentication Standard",
    "document_type": "Technical standard",
    "control_reference": "Annex A.8.5"
  },
  {
    "file": "pdfs/iso_a8_5_partial_service_account_gap.pdf",
    "target_control_id": "ISO.A8.5",
    "framework": "ISO27001",
    "ground_truth_status": "partially_compliant",
    "planted_gap": "Human and privileged authentication is established, but two in-scope application/service accounts still rely on long-lived API keys without secure short-lived authentication or MFA-equivalent protection.",
    "document_title": "Authentication and Login Procedure",
    "document_type": "Technical procedure",
    "control_reference": "Annex A.8.5"
  },
  {
    "file": "pdfs/iso_a8_5_noncompliant_asset_inventory.pdf",
    "target_control_id": "ISO.A8.5",
    "framework": "ISO27001",
    "ground_truth_status": "non_compliant",
    "planted_gap": "Off-target as evidence: the document inventories technology assets but contains no secure authentication technology or procedure and no evidence about how access restrictions drive authentication strength.",
    "document_title": "Technology Asset Inventory Extract",
    "document_type": "Asset inventory report",
    "control_reference": "Annex A.8.5"
  },
  {
    "file": "pdfs/nist_pr_aa_05_compliant_access_governance_standard.pdf",
    "target_control_id": "NIST.PR.AA.05",
    "framework": "NIST_CSF",
    "ground_truth_status": "compliant",
    "planted_gap": null,
    "document_title": "Access Permissions and Authorization Standard",
    "document_type": "Access-control standard",
    "control_reference": "PR.AA-05"
  },
  {
    "file": "pdfs/nist_pr_aa_05_partial_emergency_access_gap.pdf",
    "target_control_id": "NIST.PR.AA.05",
    "framework": "NIST_CSF",
    "ground_truth_status": "partially_compliant",
    "planted_gap": "The standard defines and enforces least-privilege access and periodic reviews, but the emergency-access workflow does not enforce separation of duties: the same person can request and approve an emergency role.",
    "document_title": "Access Review and Authorization Procedure",
    "document_type": "Access-control procedure",
    "control_reference": "PR.AA-05"
  },
  {
    "file": "pdfs/nist_pr_aa_05_noncompliant_facility_badge_procedure.pdf",
    "target_control_id": "NIST.PR.AA.05",
    "framework": "NIST_CSF",
    "ground_truth_status": "non_compliant",
    "planted_gap": "Off-target as evidence: the procedure addresses physical badges and visitors, not logical access permissions, policy-defined entitlements, least privilege, or separation of duties.",
    "document_title": "Visitor and Facility Badge Procedure",
    "document_type": "Physical-security procedure",
    "control_reference": "PR.AA-05"
  },
  {
    "file": "pdfs/nist_de_cm_01_compliant_network_detection_runbook.pdf",
    "target_control_id": "NIST.DE.CM.01",
    "framework": "NIST_CSF",
    "ground_truth_status": "compliant",
    "planted_gap": null,
    "document_title": "Network and Network-Service Monitoring Runbook",
    "document_type": "Security operations runbook",
    "control_reference": "DE.CM-01"
  },
  {
    "file": "pdfs/nist_de_cm_01_partial_branch_monitoring_gap.pdf",
    "target_control_id": "NIST.DE.CM.01",
    "framework": "NIST_CSF",
    "ground_truth_status": "partially_compliant",
    "planted_gap": "Core networks and services are monitored, but the Pune branch network has no connection-event telemetry or detection coverage for potentially adverse events.",
    "document_title": "Network Monitoring Operations Report",
    "document_type": "Monitoring operations report",
    "control_reference": "DE.CM-01"
  },
  {
    "file": "pdfs/nist_de_cm_01_noncompliant_backup_restore_report.pdf",
    "target_control_id": "NIST.DE.CM.01",
    "framework": "NIST_CSF",
    "ground_truth_status": "non_compliant",
    "planted_gap": "Off-target as evidence: the report demonstrates a backup restoration exercise, not monitoring of networks and network services for potentially adverse events.",
    "document_title": "Quarterly Backup Restore Test Report",
    "document_type": "Business continuity test report",
    "control_reference": "DE.CM-01"
  },
  {
    "file": "pdfs/pci_10_2_compliant_cde_logging_standard.pdf",
    "target_control_id": "PCI.10.2",
    "framework": "PCI_DSS",
    "ground_truth_status": "compliant",
    "planted_gap": null,
    "document_title": "Cardholder Data Environment Logging Standard",
    "document_type": "Technical standard",
    "control_reference": "PCI-DSS v4.0 Req 10.2"
  },
  {
    "file": "pdfs/pci_10_2_partial_api_alerting_gap.pdf",
    "target_control_id": "PCI.10.2",
    "framework": "PCI_DSS",
    "ground_truth_status": "partially_compliant",
    "planted_gap": "Audit events exist for most CDE components, but the three new payment-status API nodes are not connected to SIEM correlation and therefore do not support the required alerting for anomalous user or administrator activity.",
    "document_title": "CDE Audit Logging Operations Review",
    "document_type": "Logging operations report",
    "control_reference": "PCI-DSS v4.0 Req 10.2"
  },
  {
    "file": "pdfs/pci_10_2_noncompliant_facility_badge_log.pdf",
    "target_control_id": "PCI.10.2",
    "framework": "PCI_DSS",
    "ground_truth_status": "non_compliant",
    "planted_gap": "Off-target as evidence: the report covers physical badge activity and provides no audit logs for user access, administrator actions, or security events in the cardholder data environment.",
    "document_title": "Facility Badge Access Log Review",
    "document_type": "Physical-security report",
    "control_reference": "PCI-DSS v4.0 Req 10.2"
  }
]
```

### Final fixture file tree

```text
apps/api/tests/fixtures/seed_evidence/
|-- generate_fixtures.py
|-- manifest.json
`-- pdfs/
    |-- iso_a5_1_compliant_information_security_policy.pdf
    |-- iso_a5_1_partial_acknowledgement_gap.pdf
    |-- iso_a5_1_noncompliant_policy_template.pdf
    |-- iso_a8_5_compliant_authentication_standard.pdf
    |-- iso_a8_5_partial_service_account_gap.pdf
    |-- iso_a8_5_noncompliant_asset_inventory.pdf
    |-- nist_pr_aa_05_compliant_access_governance_standard.pdf
    |-- nist_pr_aa_05_partial_emergency_access_gap.pdf
    |-- nist_pr_aa_05_noncompliant_facility_badge_procedure.pdf
    |-- nist_de_cm_01_compliant_network_detection_runbook.pdf
    |-- nist_de_cm_01_partial_branch_monitoring_gap.pdf
    |-- nist_de_cm_01_noncompliant_backup_restore_report.pdf
    |-- pci_10_2_compliant_cde_logging_standard.pdf
    |-- pci_10_2_partial_api_alerting_gap.pdf
    |-- pci_10_2_noncompliant_facility_badge_log.pdf
```

### Verification

Generation command and output:

```text
PYTHONPATH=/Users/saqlainmomin/ai_audit_copilot/apps/api python3 apps/api/tests/fixtures/seed_evidence/generate_fixtures.py
Generated 15 PDFs in /Users/saqlainmomin/ai_audit_copilot/apps/api/tests/fixtures/seed_evidence/pdfs
Manifest: /Users/saqlainmomin/ai_audit_copilot/apps/api/tests/fixtures/seed_evidence/manifest.json
```

The verification script opened every PDF with `pypdf`. All 15 PDFs have a non-empty text layer, and the manifest has 5 compliant, 5 partially compliant, and 5 non-compliant entries.

| File | Pages | Extracted characters |
| --- | ---: | ---: |
| `iso_a5_1_compliant_information_security_policy.pdf` | 1 | 1799 |
| `iso_a5_1_partial_acknowledgement_gap.pdf` | 1 | 1509 |
| `iso_a5_1_noncompliant_policy_template.pdf` | 1 | 885 |
| `iso_a8_5_compliant_authentication_standard.pdf` | 1 | 1746 |
| `iso_a8_5_partial_service_account_gap.pdf` | 1 | 1510 |
| `iso_a8_5_noncompliant_asset_inventory.pdf` | 1 | 920 |
| `nist_pr_aa_05_compliant_access_governance_standard.pdf` | 1 | 1600 |
| `nist_pr_aa_05_partial_emergency_access_gap.pdf` | 1 | 1597 |
| `nist_pr_aa_05_noncompliant_facility_badge_procedure.pdf` | 1 | 929 |
| `nist_de_cm_01_compliant_network_detection_runbook.pdf` | 1 | 1525 |
| `nist_de_cm_01_partial_branch_monitoring_gap.pdf` | 1 | 1327 |
| `nist_de_cm_01_noncompliant_backup_restore_report.pdf` | 1 | 941 |
| `pci_10_2_compliant_cde_logging_standard.pdf` | 1 | 1683 |
| `pci_10_2_partial_api_alerting_gap.pdf` | 1 | 1448 |
| `pci_10_2_noncompliant_facility_badge_log.pdf` | 1 | 990 |

Manual extracted-text spot checks:

- `iso_a5_1_compliant_information_security_policy.pdf` reads as a complete policy suite with management approval, controlled publication, personnel and supplier communication, and 486/486 acknowledgements, matching the compliant ground truth.
- `iso_a8_5_partial_service_account_gap.pdf` covers workforce MFA, FIDO2 administrator access, vault controls, monitoring, and review, while limiting the shortfall to two vendor integrations using long-lived API keys, matching the partial ground truth.
- `pci_10_2_noncompliant_facility_badge_log.pdf` is a plausible physical-entry review whose scope excludes system-component access, administrator actions, audit-event generation, SIEM ingestion, and security alerting, matching the off-target ground truth.

Upload/analyze end-to-end verification against the real backend was deliberately left for a follow-up pass. This session had no live Groq/Supabase credentials, and the handoff separates fixture generation from uploading or touching real application data.
