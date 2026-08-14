const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export interface UploadLookupResponse {
  kind: "active" | "invalid" | "expired";
  request?: {
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
  };
  stakeholder?: {
    id: string;
    full_name: string;
    email: string;
    role_title: string;
  };
  auditor?: {
    name: string;
    firm: string;
    email: string;
  };
}

export async function lookupUploadToken(token: string): Promise<UploadLookupResponse> {
  const response = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(token)}`);
  if (!response.ok) {
    return { kind: "invalid" };
  }
  return response.json();
}
