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

export interface Engagement {
  id: string;
  name: string;
  client_name: string;
  framework: "SOC2";
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
