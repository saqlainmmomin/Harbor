import type { CompletenessLabel, DecisionType, Framework, RequestStatus } from "./types";

// Real wall-clock time. The old mock-data.ts `TODAY` constant froze this at
// 2026-07-29 so the seeded demo rows' overdue/due-soon states stayed stable
// — fine for fabricated data authored against that date, wrong once this
// function runs against real due dates from Postgres (a real request due
// yesterday must show as overdue today, not on some frozen prototype date).
function today(): Date {
  return new Date();
}

const DAY_MS = 86_400_000;

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} to ${formatDate(end)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function relativeTime(iso: string): string {
  const diff = today().getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Negative = overdue. */
export function daysUntil(isoDate: string): number {
  const due = new Date(`${isoDate}T00:00:00Z`).getTime();
  const now = new Date(today().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((due - now) / DAY_MS);
}

export function dueLabel(isoDate: string): { text: string; tone: "overdue" | "soon" | "normal" } {
  const d = daysUntil(isoDate);
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, tone: "overdue" };
  if (d === 0) return { text: "Due today", tone: "soon" };
  if (d <= 3) return { text: `Due in ${d}d`, tone: "soon" };
  return { text: formatDate(isoDate), tone: "normal" };
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  not_sent: "Not sent",
  awaiting_upload: "Awaiting upload",
  ai_processing: "AI processing",
  pending_review: "Needs your review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

export const COMPLETENESS_LABEL: Record<CompletenessLabel, string> = {
  complete: "Complete",
  partial: "Partial",
  insufficient: "Insufficient",
};

export const DECISION_LABEL: Record<DecisionType, string> = {
  approve: "Approved",
  reject: "Rejected",
  request_more: "More evidence requested",
};

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  ISO27001: "ISO 27001",
  NIST_CSF: "NIST CSF",
  PCI_DSS: "PCI-DSS",
};
