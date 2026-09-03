// Mirrors the Postgres schema. Keep field names identical to the DB columns so
// swapping mock-data.ts for real API responses is a one-line change per screen.

export type RequestStatus =
  | "not_sent"
  | "awaiting_upload"
  | "ai_processing"
  | "pending_review"
  | "changes_requested"
  | "approved"
  | "rejected";

/** Deliberately a label, not a numeric score — auditors distrust false precision. */
export type CompletenessLabel = "complete" | "partial" | "insufficient";

export type DecisionType = "approve" | "reject" | "request_more";

export type FlagSeverity = "blocker" | "warning" | "info";

export type Framework = "SOC2" | "ISO27001";
export type CompanySize = "startup" | "smb" | "mid_market" | "enterprise";

export interface Engagement {
  id: string;
  name: string;
  client_name: string;
  industry: string | null;
  company_size: CompanySize | null;
  description: string | null;
  frameworks: Framework[];
  period_start: string; // ISO date
  period_end: string;
  lead_auditor: string;
}

export interface Control {
  id: string;
  ref: string; // e.g. "CC6.1"
  category: string; // e.g. "Logical Access"
  title: string;
}

export interface Stakeholder {
  id: string;
  full_name: string;
  email: string;
  role_title: string; // "IT Manager", "DevOps Lead"
}

export interface EvidenceFile {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  uploaded_at: string; // ISO datetime
  uploaded_by_stakeholder_id: string;
}

export interface AiFlag {
  id: string;
  severity: FlagSeverity;
  title: string;
  detail: string;
  /** Where in the document the model saw this. Auditors need provenance, not verdicts. */
  location: string | null;
}

export interface AiExcerpt {
  location: string; // "p.3 §2.1"
  text: string;
}

export type ConfidenceLabel = "strong_match" | "partial_match" | "weak_match";

export interface SuggestedControl {
  control_name: string;
  confidence_label: ConfidenceLabel;
  rationale: string;
}

export interface AiReview {
  id: string;
  evidence_file_id: string;
  model: string;
  reviewed_at: string;
  doc_type: string; // classified: "Access Review Export", "Policy Document", ...
  doc_type_alternatives: string[];
  summary: string;
  completeness: CompletenessLabel;
  suggested_control_refs: string[];
  /** Present when sourced from the real API (apps/api) — richer than
   * suggested_control_refs, carries confidence + rationale per control.
   * Mock data doesn't set this; the UI falls back to suggested_control_refs
   * when it's absent. */
  suggested_controls?: SuggestedControl[];
  flags: AiFlag[];
  excerpts: AiExcerpt[];

  // --- Control-aware analysis fields (POST /evidence-files/{id}/analyze).
  // Added alongside the original document-summary fields above rather than
  // replacing them, so any other view still reading doc_type/summary/flags/
  // excerpts keeps working (they're derived from these where possible — see
  // lib/api.ts's mapWireAiReviewInner). Optional because older/legacy
  // reviews (and the mock-data fallback) never set them.
  compliance_status?: ComplianceStatus;
  current_state?: string;
  gap_description?: string;
  evidence_quote?: string;
  risk_level?: string;
  /** The single most useful field to an auditor deciding what's missing:
   * a specific, concrete description of what to collect next. */
  follow_up_evidence?: string;
  control_id_matched?: string | null;
}

export type ComplianceStatus = "compliant" | "partially_compliant" | "non_compliant" | "not_assessed";

// --- Scope -> RFI workflow types. Kept deliberately separate from the
// existing `Framework` type (SOC2/ISO27001, used by engagement creation) —
// that flow is out of scope for this feature and isn't touched. The scope
// questionnaire only ever offers these three.
export type ScopeFramework = "ISO27001" | "NIST_CSF" | "PCI_DSS";

export type ScopeQuestionType = "single_select" | "multi_select";

export interface ScopeQuestionOption {
  value: string;
  label: string;
}

export interface ScopeQuestion {
  id: string;
  question: string;
  help_text: string | null;
  type: ScopeQuestionType;
  options: ScopeQuestionOption[];
}

export interface ExcludedControl {
  id: string;
  reason: string;
}

export interface EvidenceChecklistItem {
  document_type: string;
  label: string;
  reason: string;
  required: boolean;
  maps_to: string[];
}

export interface EngagementScope {
  applicable_controls: string[];
  excluded_controls: ExcludedControl[];
  evidence_checklist: EvidenceChecklistItem[];
}

/** A single answer for a scope question: a string for `single_select`, a
 * string array for `multi_select`. */
export type ScopeAnswerValue = string | string[];

export type ScopeAnswers = Record<ScopeFramework, Record<string, ScopeAnswerValue>>;

export interface RfiDraftItem {
  control_ref: string;
  title: string;
  description: string;
  due_date: string | null;
}

/** One row of the editable RFI draft table in the UI -- adds the fields the
 * auditor must fill in before it can become a real evidence request
 * (stakeholder + due date), plus a client-only `key` for React list identity
 * across add/remove/edit. */
export interface RfiDraftRow {
  key: string;
  control_ref: string;
  title: string;
  description: string;
  stakeholder_id: string;
  due_date: string;
}

export interface ReviewDecision {
  id: string;
  decision: DecisionType;
  note: string;
  decided_by: string;
  decided_at: string;
}

export interface EvidenceRequest {
  id: string;
  engagement_id: string;
  control_ref: string;
  title: string;
  description: string;
  stakeholder_id: string;
  status: RequestStatus;
  due_date: string; // ISO date
  sent_at: string | null;
  reminder_count: number;
  files: EvidenceFile[];
  ai_review: AiReview | null;
  decision: ReviewDecision | null;
  last_activity_at: string;
}

export interface ActivityEntry {
  id: string;
  request_id: string | null;
  actor: string;
  actor_type: "auditor" | "stakeholder" | "system" | "ai";
  action: string;
  detail: string | null;
  created_at: string;
}
