import { daysUntil } from "@/lib/format";
import type { EvidenceRequest, RequestStatus } from "@/lib/types";

// Shared between the Overview dashboard and the Requests table -- both need
// the same definitions of "overdue" / "urgent" / "open" so the two screens
// never quietly disagree with each other about what counts as what.

export const OPEN_STATUSES: RequestStatus[] = [
  "not_sent",
  "awaiting_upload",
  "ai_processing",
  "pending_review",
  "changes_requested",
];

export function isOverdue(r: EvidenceRequest): boolean {
  return OPEN_STATUSES.includes(r.status) && daysUntil(r.due_date) < 0;
}

export function isUrgent(r: EvidenceRequest): boolean {
  return r.status === "pending_review" || isOverdue(r);
}

export interface RequestCounts {
  needs_review: number;
  overdue: number;
  outstanding: number;
  closed: number;
  approved: number;
  all: number;
}

export function countRequests(requests: EvidenceRequest[]): RequestCounts {
  return {
    needs_review: requests.filter((r) => r.status === "pending_review").length,
    overdue: requests.filter(isOverdue).length,
    outstanding: requests.filter((r) => OPEN_STATUSES.includes(r.status)).length,
    closed: requests.filter((r) => r.status === "approved" || r.status === "rejected").length,
    approved: requests.filter((r) => r.status === "approved").length,
    all: requests.length,
  };
}

/** Real proxy for "control readiness": the fraction of controls actually
 * referenced by this engagement's requests that have an approved request
 * against them. Not a full control-library readiness score (that would
 * need a real Controls entity, which doesn't exist yet) -- but it's
 * computed from real data, not fabricated. */
export function controlReadinessPct(requests: EvidenceRequest[]): number {
  const allControls = new Set(requests.map((r) => r.control_ref));
  if (allControls.size === 0) return 0;
  const approvedControls = new Set(requests.filter((r) => r.status === "approved").map((r) => r.control_ref));
  return Math.round((approvedControls.size / allControls.size) * 100);
}

export function aiReviewPct(requests: EvidenceRequest[]): number {
  if (requests.length === 0) return 0;
  return Math.round((requests.filter((r) => r.ai_review).length / requests.length) * 100);
}

/** Requests where the AI review itself flagged something -- either the
 * model's own completeness judgment came back "insufficient", or there's at
 * least one real flag (missing_sections / the placeholder-detection floor).
 * This is what the dashboard's "potential exceptions" count means today. */
export function potentialExceptions(requests: EvidenceRequest[]): EvidenceRequest[] {
  return requests.filter((r) => r.ai_review && (r.ai_review.completeness === "insufficient" || r.ai_review.flags.length > 0));
}

export interface ControlGroup {
  control_ref: string;
  requests: EvidenceRequest[];
  /** "Ready" only once every request mapped to this control is approved --
   * one control can have several requests (e.g. one per evidence period). */
  ready: boolean;
  overdue: number;
  needs_review: number;
  outstanding: number;
}

/** Groups requests by the control they were requested against. There's no
 * real Controls entity/library in the database yet -- this is derived
 * entirely from real evidence requests, the same real `control_ref` string
 * already shown as a chip everywhere else in the app, not a fabricated
 * control catalog. */
export function groupByControl(requests: EvidenceRequest[]): ControlGroup[] {
  const groups = new Map<string, EvidenceRequest[]>();
  for (const r of requests) {
    const list = groups.get(r.control_ref);
    if (list) list.push(r);
    else groups.set(r.control_ref, [r]);
  }
  return Array.from(groups.entries())
    .map(([control_ref, reqs]) => ({
      control_ref,
      requests: reqs,
      ready: reqs.every((r) => r.status === "approved"),
      overdue: reqs.filter(isOverdue).length,
      needs_review: reqs.filter((r) => r.status === "pending_review").length,
      outstanding: reqs.filter((r) => OPEN_STATUSES.includes(r.status)).length,
    }))
    .sort((a, b) => a.control_ref.localeCompare(b.control_ref));
}
