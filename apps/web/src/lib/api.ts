import type { EvidenceRequest, Stakeholder, RequestStatus } from "@/lib/types";
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
