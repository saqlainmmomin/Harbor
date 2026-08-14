// Mock resolver for the stakeholder magic-link route. A real token is a signed
// JWT (requestId + exp) verified server-side; this stands in until the API
// exists. Kept separate from mock-data.ts because it's link/auth plumbing,
// not seeded domain data.

import { getRequest, stakeholderById } from "./mock-data";
import type { EvidenceRequest, Stakeholder } from "./types";

export interface AuditorContact {
  name: string;
  firm: string;
  email: string;
}

// Single lead auditor in this prototype — the real engagement can have more.
export const auditorContact: AuditorContact = {
  name: "Anjali Rao",
  firm: "Rao & Associates LLP",
  email: "arao@raoassociates.example",
};

interface MagicLinkEntry {
  requestId: string;
  status: "active" | "expired";
}

const MAGIC_LINKS: Record<string, MagicLinkEntry> = {
  // Plain ask, nothing submitted yet, badly overdue — urgency demo.
  "a8f3d1e9c2b74f10": { requestId: "req_009", status: "active" },
  // Auditor requested more evidence on top of a prior submission.
  "6c2e9b45f0a1d837": { requestId: "req_007", status: "active" },
  // Plain ask, comfortably ahead of the due date — calm-state demo.
  "119ffa3d8e2c5b06": { requestId: "req_013", status: "active" },
  // Already reviewed and accepted — "nothing left to do" demo.
  "d0f2c7b3a94e6158": { requestId: "req_003", status: "active" },
  // Signature still decodes (so we know who to contact) but has expired.
  "70e451b8f2a9d3c6": { requestId: "req_015", status: "expired" },
};

export type LinkResolution =
  | { kind: "invalid" }
  | { kind: "expired"; auditor: AuditorContact }
  | {
      kind: "active";
      request: EvidenceRequest;
      stakeholder: Stakeholder;
      auditor: AuditorContact;
    };

export function resolveMagicLink(token: string): LinkResolution {
  const entry = MAGIC_LINKS[token];
  if (!entry) return { kind: "invalid" };

  const request = getRequest(entry.requestId);
  if (!request) return { kind: "invalid" };

  if (entry.status === "expired") {
    return { kind: "expired", auditor: auditorContact };
  }

  return {
    kind: "active",
    request,
    stakeholder: stakeholderById[request.stakeholder_id],
    auditor: auditorContact,
  };
}
