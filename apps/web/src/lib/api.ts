import type { AiReview, ConfidenceLabel, CompletenessLabel, Engagement, EvidenceRequest, Stakeholder, RequestStatus } from "@/lib/types";
import type { AuditorContact } from "@/lib/upload-link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Wire shape actually returned by app/upload_lookup.py today. Notably: no
// `ai_review` or `decision` — the backend has no `review_decisions` table
// yet (only `ai_reviews` exists), so this endpoint can't supply them.
interface ApiEvidenceRequestWire {
  id: string;
  engagement_id: string;
  control_ref: string;
  title: string;
  description: string;
  stakeholder_id: string;
  status: string;
  due_date: string;
  sent_at: string | null;
  reminder_count: number;
  last_activity_at: string;
  files: Array<{ id: string; filename: string; mime_type: string; size_bytes: number; page_count: number | null; uploaded_at: string; uploaded_by_stakeholder_id: string }>;
}

interface ApiLookupWire {
  kind: "active" | "invalid" | "expired";
  request?: ApiEvidenceRequestWire;
  stakeholder?: Stakeholder;
  auditor?: AuditorContact;
}

// Discriminated on `kind` so callers get `request`/`stakeholder`/`auditor` as
// non-optional once they've checked kind === "active". `request` is the full
// app-wide EvidenceRequest shape — see mapWireRequest for how the (currently
// unavailable) ai_review/decision fields are filled in.
export type UploadLookupResponse =
  | { kind: "active"; request: EvidenceRequest; stakeholder: Stakeholder; auditor: AuditorContact }
  | { kind: "expired"; auditor?: AuditorContact }
  | { kind: "invalid" };

function mapWireRequest(wire: ApiEvidenceRequestWire): EvidenceRequest {
  return {
    ...wire,
    status: wire.status as RequestStatus,
    // Not yet returned by the backend (no review_decisions table, and this
    // endpoint doesn't join ai_reviews) — explicitly null, not guessed.
    ai_review: null,
    decision: null,
  };
}

export async function lookupUploadToken(token: string): Promise<UploadLookupResponse> {
  const response = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(token)}`);
  if (!response.ok) {
    return { kind: "invalid" };
  }
  const wire: ApiLookupWire = await response.json();

  if (wire.kind !== "active") {
    return { kind: wire.kind, auditor: wire.auditor } as UploadLookupResponse;
  }
  if (!wire.request || !wire.stakeholder || !wire.auditor) {
    // Backend said "active" but didn't send what that implies — treat as
    // invalid rather than crash the page on a malformed response.
    return { kind: "invalid" };
  }
  return {
    kind: "active",
    request: mapWireRequest(wire.request),
    stakeholder: wire.stakeholder,
    auditor: wire.auditor,
  };
}

// --- GET /evidence-requests/{id} — powers the review panel's request detail
// (title, description, status, submitted files). Distinct from the upload
// endpoint above: this one is keyed by request id, not magic-link token, and
// its `files` are the real submitted list (see app/upload_lookup.py's
// get_request_detail vs lookup_upload).
interface RequestDetailWire {
  request: ApiEvidenceRequestWire;
  stakeholder: Stakeholder;
}

export async function fetchRequestDetail(
  requestId: string,
): Promise<{ request: EvidenceRequest; stakeholder: Stakeholder } | null> {
  const response = await fetch(`${API_BASE_URL}/evidence-requests/${encodeURIComponent(requestId)}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const wire: RequestDetailWire = await response.json();
  return { request: mapWireRequest(wire.request), stakeholder: wire.stakeholder };
}

// --- GET /evidence-requests/{id}/review — the actual AI output for the
// most recently submitted file. `ai_review` is null when a file was
// uploaded but analysis hasn't produced a row yet (see main.py); the whole
// call 404s when no file has been submitted at all.
interface WireSuggestedControl {
  control_name: string;
  confidence_label: ConfidenceLabel;
  rationale: string;
}

interface WireAiReview {
  id: string;
  document_type: string | null;
  summary: string | null;
  suggested_controls: WireSuggestedControl[] | null;
  missing_sections: string[] | null;
  completeness_label: CompletenessLabel | null;
  raw_response: { model_requested?: string; model_resolved?: string } | null;
  created_at: string;
}

interface EvidenceReviewWire {
  evidence_file: { id: string; filename: string; path: string; uploaded_at: string };
  ai_review: WireAiReview | null;
}

export async function fetchEvidenceReview(requestId: string): Promise<EvidenceReviewWire | null> {
  const response = await fetch(`${API_BASE_URL}/evidence-requests/${encodeURIComponent(requestId)}/review`, {
    cache: "no-store",
  });
  // 404 means no file has been submitted yet — same "nothing to show" case
  // as a null ai_review, just one step earlier.
  if (!response.ok) return null;
  return response.json();
}

/** Maps the wire review shape onto the app-wide AiReview type. Fields the
 * real pipeline doesn't produce (doc_type_alternatives, excerpts) are left
 * empty rather than fabricated — the UI already hides those sections when
 * empty, so this doesn't imply capability that isn't there. Shared by the
 * review-panel fetch (fetchEvidenceReview, one request at a time) and the
 * dashboard list fetch (fetchEngagementRequests, ai_review inlined per row)
 * below. */
function mapWireAiReviewInner(r: WireAiReview | null, evidenceFileId: string): AiReview | null {
  if (!r) return null;
  return {
    id: r.id,
    evidence_file_id: evidenceFileId,
    model: r.raw_response?.model_resolved || r.raw_response?.model_requested || "unknown model",
    reviewed_at: r.created_at,
    doc_type: r.document_type ?? "Unclassified document",
    doc_type_alternatives: [],
    summary: r.summary ?? "",
    completeness: r.completeness_label ?? "insufficient",
    suggested_control_refs: (r.suggested_controls ?? []).map((c) => c.control_name),
    suggested_controls: r.suggested_controls ?? undefined,
    flags: (r.missing_sections ?? []).map((section, i) => ({
      id: `missing_${i}`,
      severity: "warning" as const,
      title: section,
      detail: "",
      location: null,
    })),
    excerpts: [],
  };
}

export function mapWireAiReview(wire: EvidenceReviewWire): AiReview | null {
  return mapWireAiReviewInner(wire.ai_review, wire.evidence_file.id);
}

// --- GET /engagements/{id} — engagement header info for the dashboard.
export async function fetchEngagement(engagementId: string): Promise<Engagement | null> {
  const response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

// --- GET /engagements/{id}/evidence-requests — every real evidence request
// for the engagement, each with its ai_review inlined. Powers the evidence
// dashboard; replaces the old mock-data.ts evidenceRequests/stakeholderById.
interface ApiDashboardRequestWire extends ApiEvidenceRequestWire {
  ai_review: WireAiReview | null;
  decision: null;
}

interface ApiDashboardWire {
  requests: ApiDashboardRequestWire[];
  stakeholders: Stakeholder[];
}

export async function fetchEngagementRequests(
  engagementId: string,
): Promise<{ requests: EvidenceRequest[]; stakeholders: Record<string, Stakeholder> }> {
  const response = await fetch(
    `${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/evidence-requests`,
    { cache: "no-store" },
  );
  if (!response.ok) return { requests: [], stakeholders: {} };

  const wire: ApiDashboardWire = await response.json();
  const stakeholders = Object.fromEntries(wire.stakeholders.map((s) => [s.id, s]));
  const requests: EvidenceRequest[] = wire.requests.map((r) => ({
    ...r,
    status: r.status as RequestStatus,
    ai_review: mapWireAiReviewInner(r.ai_review, r.files[0]?.id ?? ""),
    decision: null,
  }));
  return { requests, stakeholders };
}
