import type {
  AiReview,
  CompanySize,
  ComplianceStatus,
  ConfidenceLabel,
  CompletenessLabel,
  DecisionType,
  Engagement,
  EngagementScope,
  EvidenceChecklistItem,
  EvidenceRequest,
  ExcludedControl,
  Framework,
  RfiDraftItem,
  ReviewDecision,
  ScopeAnswers,
  ScopeFramework,
  ScopeQuestion,
  Stakeholder,
  RequestStatus,
} from "@/lib/types";
import type { AuditorContact } from "@/lib/upload-link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

interface WireDecision {
  id: string;
  decision: string;
  note: string | null;
  decided_by: string;
  decided_at: string;
}

// Wire shape actually returned by app/upload_lookup.py today. `ai_review`
// still isn't inlined here (this endpoint doesn't join ai_reviews) --
// `decision` now is, since review_decisions is a real table (see
// submitDecision below).
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
  decision?: WireDecision | null;
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
// unavailable) ai_review field is filled in.
export type UploadLookupResponse =
  | { kind: "active"; request: EvidenceRequest; stakeholder: Stakeholder; auditor: AuditorContact }
  | { kind: "expired"; auditor?: AuditorContact }
  | { kind: "invalid" };

function mapWireDecision(d: WireDecision | null | undefined): ReviewDecision | null {
  if (!d) return null;
  return { id: d.id, decision: d.decision as DecisionType, note: d.note ?? "", decided_by: d.decided_by, decided_at: d.decided_at };
}

function mapWireRequest(wire: ApiEvidenceRequestWire): EvidenceRequest {
  return {
    ...wire,
    status: wire.status as RequestStatus,
    // Not yet returned by the backend — this endpoint doesn't join
    // ai_reviews. Real elsewhere (fetchEvidenceReview, fetchEngagementRequests).
    ai_review: null,
    decision: mapWireDecision(wire.decision),
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
  // `text` is Groq's raw JSON response body as a string (see main.py's
  // ai_reviews.raw_response) -- verified against the real running backend
  // that this is the ONLY place a persisted control-aware review's
  // compliance_status/current_state/gap_description/evidence_quote/
  // risk_level/follow_up_evidence survive a page reload: GET
  // .../evidence-requests/{id}/review does not expose them as their own
  // top-level columns (only POST /evidence-files/{id}/analyze's own
  // response does, per the frozen contract). Parsed as a fallback below.
  raw_response: { model_requested?: string; model_resolved?: string; text?: string } | null;
  created_at: string;
  // --- Control-aware analysis columns (added to ai_reviews by the analyze
  // endpoint). Optional/nullable: older rows and the old document-summary
  // pipeline never set these; and as of the currently-running backend,
  // GET .../review never populates them even for a control-aware review --
  // see raw_response above for where that data actually lives on reload.
  compliance_status?: ComplianceStatus | null;
  current_state?: string | null;
  gap_description?: string | null;
  evidence_quote?: string | null;
  risk_level?: string | null;
  follow_up_evidence?: string | null;
  control_id_matched?: string | null;
}

/** Best-effort parse of raw_response.text as the control-aware analyze JSON
 * shape. Returns null for anything that isn't that shape (old document-
 * summary reviews' raw_response.text, if ever set, won't have these keys) --
 * mapWireAiReviewInner below only uses fields from here when the dedicated
 * columns above are absent, so a wrong guess just leaves those fields empty
 * rather than fabricating something. */
function parseRawAnalyzeText(text: string | null | undefined): Partial<WireAiReview> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "compliance_status" in parsed) {
      return parsed as Partial<WireAiReview>;
    }
  } catch {
    // not JSON, or not this shape -- fine, just no fallback data
  }
  return null;
}

function complianceToCompleteness(status: ComplianceStatus | null | undefined): CompletenessLabel {
  if (status === "compliant") return "complete";
  if (status === "partially_compliant") return "partial";
  // non_compliant, not_assessed, or unset -- "insufficient" is the safest
  // default for the dashboard's existing completeness-driven views (needs-
  // attention filters, badges) rather than fabricating a middle ground.
  return "insufficient";
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
function mapWireAiReviewInner(rIn: WireAiReview | null, evidenceFileId: string): AiReview | null {
  if (!rIn) return null;
  // Fall back to parsing the raw Groq JSON when the dedicated columns are
  // absent -- see parseRawAnalyzeText's comment. Dedicated columns (if the
  // backend ever does populate them) always win over the parsed fallback.
  const fallback = parseRawAnalyzeText(rIn.raw_response?.text);
  const r: WireAiReview = fallback
    ? {
        ...rIn,
        compliance_status: rIn.compliance_status ?? fallback.compliance_status,
        current_state: rIn.current_state ?? fallback.current_state,
        gap_description: rIn.gap_description ?? fallback.gap_description,
        evidence_quote: rIn.evidence_quote ?? fallback.evidence_quote,
        risk_level: rIn.risk_level ?? fallback.risk_level,
        follow_up_evidence: rIn.follow_up_evidence ?? fallback.follow_up_evidence,
        control_id_matched: rIn.control_id_matched ?? fallback.control_id_matched,
      }
    : rIn;
  const flags: AiReview["flags"] = (r.missing_sections ?? []).map((section, i) => ({
    id: `missing_${i}`,
    severity: "warning" as const,
    title: section,
    detail: "",
    location: null,
  }));
  // Control-aware analysis doesn't populate missing_sections -- surface its
  // gap_description as an equivalent flag so dashboard views that filter on
  // `flags.length` (e.g. potentialExceptions in request-status.ts) still see
  // it, instead of only working for the old document-summary pipeline.
  if (flags.length === 0 && r.gap_description && r.compliance_status !== "compliant") {
    flags.push({
      id: "gap",
      severity: r.compliance_status === "non_compliant" ? ("blocker" as const) : ("warning" as const),
      title: "Gap identified",
      detail: r.gap_description,
      location: null,
    });
  }
  return {
    id: r.id,
    evidence_file_id: evidenceFileId,
    model: r.raw_response?.model_resolved || r.raw_response?.model_requested || "unknown model",
    reviewed_at: r.created_at,
    doc_type: r.document_type ?? (r.control_id_matched ? `Evidence for ${r.control_id_matched}` : "Unclassified document"),
    doc_type_alternatives: [],
    summary: r.summary ?? r.current_state ?? "",
    completeness: r.completeness_label ?? complianceToCompleteness(r.compliance_status),
    suggested_control_refs: (r.suggested_controls ?? []).map((c) => c.control_name),
    suggested_controls: r.suggested_controls ?? undefined,
    flags,
    excerpts: r.evidence_quote ? [{ location: "Evidence excerpt", text: r.evidence_quote }] : [],
    compliance_status: r.compliance_status ?? undefined,
    current_state: r.current_state ?? undefined,
    gap_description: r.gap_description ?? undefined,
    evidence_quote: r.evidence_quote ?? undefined,
    risk_level: r.risk_level ?? undefined,
    follow_up_evidence: r.follow_up_evidence ?? undefined,
    control_id_matched: r.control_id_matched ?? undefined,
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

// --- POST /engagements — real creation, backs the /engagements/new form.
export interface CreateEngagementInput {
  client_name: string;
  name: string;
  industry: string;
  company_size: CompanySize;
  description?: string;
  frameworks: Framework[];
  period_start: string;
  period_end: string;
  lead_auditor: string;
}

export type CreateEngagementResult = { ok: true; engagement: Engagement } | { ok: false; message: string };

export async function createEngagement(input: CreateEngagementInput): Promise<CreateEngagementResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/engagements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) return { ok: true, engagement: await response.json() };

  let message = `Could not create engagement (HTTP ${response.status})`;
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") message = body.detail;
  } catch {
    // non-JSON error body — keep the generic message
  }
  return { ok: false, message };
}

// --- GET /engagements/{id}/evidence-requests — every real evidence request
// for the engagement, each with its ai_review inlined. Powers the evidence
// dashboard; replaces the old mock-data.ts evidenceRequests/stakeholderById.
interface ApiDashboardRequestWire extends ApiEvidenceRequestWire {
  ai_review: WireAiReview | null;
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
    decision: mapWireDecision(r.decision),
  }));
  return { requests, stakeholders };
}

// --- POST /evidence-requests/{id}/upload — the stakeholder's actual file
// submission. One file per call (that's what the backend accepts); the
// upload form calls this once per selected file, sequentially.
export type UploadEvidenceFileResult =
  | { ok: true }
  | { ok: false; received: boolean; message: string };

export async function uploadEvidenceFile(requestId: string, file: File): Promise<UploadEvidenceFileResult> {
  const formData = new FormData();
  formData.append("file", file);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/evidence-requests/${encodeURIComponent(requestId)}/upload`, {
      method: "POST",
      body: formData,
    });
  } catch (exc) {
    return { ok: false, received: false, message: exc instanceof Error ? exc.message : "Network error" };
  }

  if (response.ok) return { ok: true };

  let message = `Upload failed (HTTP ${response.status})`;
  let received = false;
  try {
    const body = await response.json();
    const detail = body?.detail;
    const detailMessage = typeof detail === "string" ? detail : detail?.message;
    if (detailMessage) message = detailMessage;
    // main.py writes the file to Supabase Storage and inserts the
    // evidence_files row BEFORE extracting PDF text or calling the review
    // model (Groq, was Gemini) — so if either of those two specific steps
    // is what failed, the evidence itself was still received, it just
    // doesn't have an AI review yet. Any other failure (bad content type,
    // Supabase Storage itself failing) means nothing was saved.
    received = detailMessage === "Failed to extract PDF text" || detailMessage === "Groq API request failed";
  } catch {
    // non-JSON error body — keep the generic HTTP-status message
  }
  return { ok: false, received, message };
}

// --- GET /engagements/{id}/activity and /evidence-requests/{id}/activity —
// real activity_log rows (main.py now actually writes to this table on
// upload + AI-analysis-complete; it didn't before).
export interface ActivityEvent {
  id: string;
  request_id?: string;
  request_title?: string;
  actor: string;
  actor_type: "auditor" | "stakeholder" | "system" | "ai";
  action: string;
  detail: string | null;
  created_at: string;
}

export async function fetchEngagementActivity(engagementId: string, limit = 20): Promise<ActivityEvent[]> {
  const response = await fetch(
    `${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/activity?limit=${limit}`,
    { cache: "no-store" },
  );
  if (!response.ok) return [];
  return response.json();
}

export async function fetchRequestActivity(requestId: string): Promise<ActivityEvent[]> {
  const response = await fetch(`${API_BASE_URL}/evidence-requests/${encodeURIComponent(requestId)}/activity`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  return response.json();
}

// --- GET /engagements/{id}/evidence-files — flattened file list for the
// Evidence page.
export interface EvidenceFileRow {
  id: string;
  filename: string;
  size_bytes: number;
  uploaded_at: string;
  request_id: string;
  request_title: string;
  control_ref: string;
  ai_review: { document_type: string | null; completeness_label: string | null; flag_count: number } | null;
}

export async function fetchEngagementEvidenceFiles(engagementId: string): Promise<EvidenceFileRow[]> {
  const response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/evidence-files`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  const wire = await response.json();
  return wire.files ?? [];
}

// --- GET /evidence-files/{id}/preview-url — short-lived signed URL so the
// browser can render the original PDF directly from Supabase Storage.
export async function fetchFilePreviewUrl(fileId: string): Promise<string | null> {
  const response = await fetch(`${API_BASE_URL}/evidence-files/${encodeURIComponent(fileId)}/preview-url`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const wire = await response.json();
  return wire.url ?? null;
}

// --- GET/POST /engagements/{id}/stakeholders — the engagement's contact
// list. Stakeholders used to be one untouched global table (fine for a
// single seeded engagement); this is the real per-engagement list.
export async function fetchEngagementStakeholders(engagementId: string): Promise<Stakeholder[]> {
  const response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/stakeholders`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  return response.json();
}

export interface CreateStakeholderInput {
  full_name: string;
  email: string;
  role_title: string;
}

export type CreateStakeholderResult = { ok: true; stakeholder: Stakeholder } | { ok: false; message: string };

export async function createStakeholder(
  engagementId: string,
  input: CreateStakeholderInput,
): Promise<CreateStakeholderResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/stakeholders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) return { ok: true, stakeholder: await response.json() };
  return { ok: false, message: await errorMessage(response, "Could not add stakeholder") };
}

// --- POST /evidence-requests — real creation, starts life at "not_sent"
// until someone calls sendEvidenceRequest below.
export interface CreateEvidenceRequestInput {
  engagement_id: string;
  stakeholder_id: string;
  control_ref: string;
  title: string;
  description: string;
  due_date: string;
}

export type CreateEvidenceRequestResult = { ok: true; request: EvidenceRequest } | { ok: false; message: string };

export async function createEvidenceRequest(
  input: CreateEvidenceRequestInput,
): Promise<CreateEvidenceRequestResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/evidence-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) {
    const wire: ApiEvidenceRequestWire = await response.json();
    return { ok: true, request: mapWireRequest(wire) };
  }
  return { ok: false, message: await errorMessage(response, "Could not create request") };
}

// --- POST /evidence-requests/{id}/send — generates (or reuses) the upload
// token, emails the stakeholder via Resend, and flips status from
// "not_sent" to "awaiting_upload".
export type SendEvidenceRequestResult = { ok: true; uploadUrl: string } | { ok: false; message: string };

export async function sendEvidenceRequest(requestId: string, toEmail: string): Promise<SendEvidenceRequestResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/evidence-requests/${encodeURIComponent(requestId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: toEmail }),
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) {
    const wire = await response.json();
    return { ok: true, uploadUrl: wire.upload_url };
  }
  return { ok: false, message: await errorMessage(response, "Could not send request") };
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  let message = `${fallback} (HTTP ${response.status})`;
  try {
    const body = await response.json();
    const detail = body?.detail;
    const detailMessage = typeof detail === "string" ? detail : detail?.message;
    if (detailMessage) message = detailMessage;
  } catch {
    // non-JSON error body — keep the generic message
  }
  return message;
}

// --- POST /evidence-requests/{id}/decision — real persistence for the
// review panel's Approve / Reject / Request more evidence buttons. Used to
// be local component state only ("prototype — nothing was saved").
export type SubmitDecisionResult = { ok: true; decision: ReviewDecision } | { ok: false; message: string };

export async function submitDecision(
  requestId: string,
  input: { decision: DecisionType; note: string; decided_by: string },
): Promise<SubmitDecisionResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/evidence-requests/${encodeURIComponent(requestId)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) {
    const wire: WireDecision = await response.json();
    const decision = mapWireDecision(wire);
    if (!decision) return { ok: false, message: "Malformed response from server" };
    return { ok: true, decision };
  }
  return { ok: false, message: await errorMessage(response, "Could not record decision") };
}

// --- GET /engagements — every engagement that exists, most recent first.
// Powers the post-sign-in landing redirect (see app/(auth)/engagements/page.tsx):
// there's no per-user scoping yet (single-engagement-prototype era), so this
// is "does at least one engagement exist" rather than "this user's engagements".
export async function fetchEngagements(): Promise<Engagement[]> {
  const response = await fetch(`${API_BASE_URL}/engagements`, { cache: "no-store" });
  if (!response.ok) return [];
  return response.json();
}

// =====================================================================
// Scope -> RFI -> control-aware analysis (new)
// =====================================================================

// --- GET /frameworks/{framework_id}/scope-questions. `framework_id` is the
// lowercase/slug form the backend registers frameworks under (e.g.
// "iso27001") -- distinct from the `ScopeFramework` wire value used in the
// scope submission body ("ISO27001"). Callers pass whichever id the
// framework picker is keyed on; see ScopeFrameworkMeta in the scope UI.
interface WireScopeQuestionsResponse {
  framework_id: string;
  questions: Array<{
    id: string;
    question: string;
    help_text: string | null;
    type: string;
    options: Array<string | { value: string; label: string }> | null;
  }>;
}

function normalizeOptions(
  options: Array<string | { value: string; label: string }> | null | undefined,
): { value: string; label: string }[] {
  return (options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

export async function fetchScopeQuestions(frameworkId: string): Promise<ScopeQuestion[]> {
  const response = await fetch(`${API_BASE_URL}/frameworks/${encodeURIComponent(frameworkId)}/scope-questions`, {
    cache: "no-store",
  });
  if (!response.ok) return [];
  const wire: WireScopeQuestionsResponse = await response.json();
  return (wire.questions ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    help_text: q.help_text,
    type: q.type === "multi_select" ? "multi_select" : "single_select",
    options: normalizeOptions(q.options),
  }));
}

interface WireEngagementScope {
  applicable_controls: string[];
  excluded_controls: ExcludedControl[];
  evidence_checklist: EvidenceChecklistItem[];
}

function mapWireScope(wire: WireEngagementScope): EngagementScope {
  return {
    applicable_controls: wire.applicable_controls ?? [],
    excluded_controls: wire.excluded_controls ?? [],
    evidence_checklist: wire.evidence_checklist ?? [],
  };
}

export type SubmitScopeResult = { ok: true; scope: EngagementScope } | { ok: false; message: string };

// --- POST /engagements/{id}/scope
export async function submitEngagementScope(
  engagementId: string,
  frameworks: ScopeFramework[],
  scopeAnswers: ScopeAnswers,
): Promise<SubmitScopeResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/scope`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frameworks, scope_answers: scopeAnswers }),
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) return { ok: true, scope: mapWireScope(await response.json()) };
  return { ok: false, message: await errorMessage(response, "Could not compute scope") };
}

// --- GET /engagements/{id}/scope -- null if not yet run (404) or on error.
export async function fetchEngagementScope(engagementId: string): Promise<EngagementScope | null> {
  const response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/scope`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  return mapWireScope(await response.json());
}

// --- POST /engagements/{id}/generate-rfi -- reads the persisted checklist,
// returns an unpersisted draft list for the auditor to edit before create.
export async function generateRfiDraft(engagementId: string): Promise<RfiDraftItem[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/generate-rfi`, {
      method: "POST",
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const wire: { items: RfiDraftItem[] } = await response.json();
  return wire.items ?? [];
}

// --- POST /engagements/{id}/evidence-requests/bulk
export interface BulkCreateItem {
  stakeholder_id: string;
  control_ref: string;
  title: string;
  description: string;
  due_date: string;
}

export type BulkCreateResult =
  | { ok: true; created: EvidenceRequest[] }
  | { ok: false; message: string };

export async function bulkCreateEvidenceRequests(
  engagementId: string,
  items: BulkCreateItem[],
): Promise<BulkCreateResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/engagements/${encodeURIComponent(engagementId)}/evidence-requests/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) {
    const wire: { created: ApiEvidenceRequestWire[] } = await response.json();
    return { ok: true, created: (wire.created ?? []).map(mapWireRequest) };
  }
  return { ok: false, message: await errorMessage(response, "Could not create requests") };
}

// --- POST /evidence-files/{file_id}/analyze -- control-aware analysis,
// replacing the old automatic-on-upload review.
//
// Originally this only reported ok/fail and relied on router.refresh() to
// re-fetch the persisted review via fetchEvidenceReview (GET .../review),
// on the assumption that endpoint would also surface compliance_status/
// current_state/gap_description/evidence_quote/risk_level/follow_up_evidence
// once the backend extended ai_reviews with those columns. Verified against
// the real running backend that this assumption was wrong: GET .../review
// still only returns the old document-summary columns (all null for a
// control-aware review) plus the raw Groq JSON buried inside
// raw_response.text -- the new columns aren't in that endpoint's response
// model, only in POST /analyze's own response (which the frozen contract
// only specified for POST /analyze, not for GET .../review). So this now
// parses and returns the POST /analyze body directly -- the review panel
// renders that immediately rather than depending on a second endpoint that
// doesn't carry the fields. router.refresh() is still called separately
// for everything else (status badge, activity log) that DOES come from the
// server round-trip correctly.
interface WireAnalyzeResponse {
  id: string;
  compliance_status: ComplianceStatus | null;
  current_state: string | null;
  gap_description: string | null;
  evidence_quote: string | null;
  risk_level: string | null;
  follow_up_evidence: string | null;
  control_id_matched: string | null;
}

export type AnalyzeEvidenceFileResult =
  | { ok: true; review: AiReview }
  | { ok: false; message: string };

export async function analyzeEvidenceFile(fileId: string): Promise<AnalyzeEvidenceFileResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/evidence-files/${encodeURIComponent(fileId)}/analyze`, {
      method: "POST",
    });
  } catch (exc) {
    return { ok: false, message: exc instanceof Error ? exc.message : "Network error" };
  }
  if (response.ok) {
    const wire: WireAnalyzeResponse = await response.json();
    const flags: AiReview["flags"] = wire.gap_description && wire.gap_description !== "No gap identified."
      ? [{
          id: "gap",
          severity: wire.compliance_status === "non_compliant" ? ("blocker" as const) : ("warning" as const),
          title: "Gap identified",
          detail: wire.gap_description,
          location: null,
        }]
      : [];
    const review: AiReview = {
      id: wire.id,
      evidence_file_id: fileId,
      model: "Groq (control-aware analysis)",
      reviewed_at: new Date().toISOString(),
      doc_type: wire.control_id_matched ? `Evidence for ${wire.control_id_matched}` : "Unclassified document",
      doc_type_alternatives: [],
      summary: wire.current_state ?? "",
      completeness: complianceToCompleteness(wire.compliance_status),
      suggested_control_refs: wire.control_id_matched ? [wire.control_id_matched] : [],
      suggested_controls: undefined,
      flags,
      excerpts: wire.evidence_quote ? [{ location: "Evidence excerpt", text: wire.evidence_quote }] : [],
      compliance_status: wire.compliance_status ?? undefined,
      current_state: wire.current_state ?? undefined,
      gap_description: wire.gap_description ?? undefined,
      evidence_quote: wire.evidence_quote ?? undefined,
      risk_level: wire.risk_level ?? undefined,
      follow_up_evidence: wire.follow_up_evidence ?? undefined,
      control_id_matched: wire.control_id_matched ?? undefined,
    };
    return { ok: true, review };
  }
  return { ok: false, message: await errorMessage(response, "Analysis failed") };
}
