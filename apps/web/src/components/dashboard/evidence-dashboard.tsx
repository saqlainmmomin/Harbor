"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, CompletenessBadge, ControlChip, StatusBadge } from "@/components/badges";
import { daysUntil, dueLabel, relativeTime } from "@/lib/format";
import type { EvidenceRequest, RequestStatus, Stakeholder } from "@/lib/types";

type Bucket = "all" | "needs_review" | "overdue" | "outstanding" | "closed";

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "needs_review", label: "Needs your review" },
  { key: "overdue", label: "Overdue" },
  { key: "outstanding", label: "Outstanding" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const OPEN_STATUSES: RequestStatus[] = [
  "not_sent",
  "awaiting_upload",
  "ai_processing",
  "pending_review",
  "changes_requested",
];

function isOverdue(r: EvidenceRequest) {
  return OPEN_STATUSES.includes(r.status) && daysUntil(r.due_date) < 0;
}

function inBucket(r: EvidenceRequest, bucket: Bucket) {
  switch (bucket) {
    case "needs_review":
      return r.status === "pending_review";
    case "overdue":
      return isOverdue(r);
    case "outstanding":
      return OPEN_STATUSES.includes(r.status);
    case "closed":
      return r.status === "approved" || r.status === "rejected";
    default:
      return true;
  }
}

export function EvidenceDashboard({
  requests,
  stakeholders,
  engagementId,
}: {
  requests: EvidenceRequest[];
  stakeholders: Record<string, Stakeholder>;
  engagementId: string;
}) {
  const [bucket, setBucket] = useState<Bucket>("needs_review");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");

  const counts = useMemo(
    () => ({
      needs_review: requests.filter((r) => r.status === "pending_review").length,
      overdue: requests.filter(isOverdue).length,
      outstanding: requests.filter((r) => OPEN_STATUSES.includes(r.status)).length,
      closed: requests.filter((r) => r.status === "approved" || r.status === "rejected").length,
      approved: requests.filter((r) => r.status === "approved").length,
      all: requests.length,
    }),
    [requests],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests
      .filter((r) => inBucket(r, bucket))
      .filter((r) => owner === "all" || r.stakeholder_id === owner)
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          r.control_ref.toLowerCase().includes(q) ||
          stakeholders[r.stakeholder_id]?.full_name.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // Auditor's real priority order: things blocking them, then things running late.
        const rank = (r: EvidenceRequest) =>
          r.status === "pending_review" ? 0 : isOverdue(r) ? 1 : OPEN_STATUSES.includes(r.status) ? 2 : 3;
        return rank(a) - rank(b) || a.due_date.localeCompare(b.due_date);
      });
  }, [requests, bucket, owner, query, stakeholders]);

  // counts.all is 0 for a brand-new engagement with no real requests yet —
  // guard against NaN% rather than dividing by zero.
  const pct = counts.all > 0 ? Math.round((counts.approved / counts.all) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Progress + queue tiles */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Evidence collection progress</h2>
            <span className="text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{counts.approved}</span> of {counts.all} approved
            </span>
          </div>
          <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100">
            <Segment n={counts.approved} total={counts.all} className="bg-emerald-500" />
            <Segment n={counts.needs_review} total={counts.all} className="bg-amber-400" />
            <Segment
              n={counts.outstanding - counts.needs_review}
              total={counts.all}
              className="bg-slate-300"
            />
            <Segment
              n={counts.closed - counts.approved}
              total={counts.all}
              className="bg-rose-400"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <Legend className="bg-emerald-500" label="Approved" n={counts.approved} />
            <Legend className="bg-amber-400" label="Awaiting auditor" n={counts.needs_review} />
            <Legend
              className="bg-slate-300"
              label="Awaiting client"
              n={counts.outstanding - counts.needs_review}
            />
            <Legend className="bg-rose-400" label="Rejected" n={counts.closed - counts.approved} />
            <span className="ml-auto font-medium text-slate-500">{pct}% complete</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:w-96">
          <Tile
            label="Needs your review"
            value={counts.needs_review}
            tone="amber"
            active={bucket === "needs_review"}
            onClick={() => setBucket("needs_review")}
          />
          <Tile
            label="Overdue"
            value={counts.overdue}
            tone="rose"
            active={bucket === "overdue"}
            onClick={() => setBucket("overdue")}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBucket(b.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                bucket === b.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {b.label}
              <span className={bucket === b.key ? "ml-1.5 text-slate-300" : "ml-1.5 text-slate-400"}>
                {counts[b.key]}
              </span>
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search requests, controls, people…"
          className="min-w-56 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
        />

        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="all">All stakeholders</option>
          {Object.values(stakeholders).map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-4xl text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <th className="px-4 py-2.5">Control</th>
                <th className="px-4 py-2.5">Evidence request</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">Due</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">AI assessment</th>
                <th className="px-4 py-2.5 text-right">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => {
                const s = stakeholders[r.stakeholder_id];
                const due = dueLabel(r.due_date);
                const blockers = r.ai_review?.flags.filter((f) => f.severity === "blocker").length ?? 0;
                return (
                  <tr key={r.id} className="group hover:bg-slate-50">
                    <td className="px-4 py-3 align-top">
                      <ControlChip refCode={r.control_ref} />
                    </td>
                    <td className="max-w-md px-4 py-3 align-top">
                      <Link
                        href={`/engagements/${engagementId}/requests/${r.id}`}
                        className="font-medium text-slate-900 group-hover:underline"
                      >
                        {r.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {r.files.length > 0
                          ? `${r.files.length} file${r.files.length > 1 ? "s" : ""}`
                          : "No files yet"}
                        {r.reminder_count > 0 && ` · ${r.reminder_count} reminder${r.reminder_count > 1 ? "s" : ""} sent`}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.full_name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{s.full_name}</p>
                          <p className="truncate text-xs text-slate-500">{s.role_title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          due.tone === "overdue"
                            ? "font-medium text-rose-600"
                            : due.tone === "soon"
                              ? "font-medium text-amber-700"
                              : "text-slate-600"
                        }
                      >
                        {due.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      {r.ai_review ? (
                        <div className="space-y-1">
                          <CompletenessBadge value={r.ai_review.completeness} withBar />
                          <p className="text-xs text-slate-500">
                            {r.ai_review.doc_type}
                            {blockers > 0 && (
                              <span className="font-medium text-rose-600">
                                {" "}
                                · {blockers} blocker{blockers > 1 ? "s" : ""}
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-top whitespace-nowrap text-slate-500">
                      {relativeTime(r.last_activity_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Nothing here. Try a different filter.
          </p>
        )}
      </div>
    </div>
  );
}

function Segment({ n, total, className }: { n: number; total: number; className: string }) {
  if (n <= 0) return null;
  return <span className={className} style={{ width: `${(n / total) * 100}%` }} aria-hidden />;
}

function Legend({ n, label, className }: { n: number; label: string; className: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${className}`} aria-hidden />
      {label} <span className="font-medium text-slate-900">{n}</span>
    </span>
  );
}

function Tile({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: "amber" | "rose";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border bg-white p-4 text-left transition ${
        active ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <p className={`text-3xl font-semibold tabular-nums ${value > 0 ? tones[tone] : "text-slate-300"}`}>
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
    </button>
  );
}
