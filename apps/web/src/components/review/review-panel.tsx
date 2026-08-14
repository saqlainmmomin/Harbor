"use client";

import { useState } from "react";
import { CompletenessBadge, severityStyle } from "@/components/badges";
import { DECISION_LABEL, formatBytes, formatDateTime, relativeTime } from "@/lib/format";
import type {
  ActivityEntry,
  DecisionType,
  EvidenceRequest,
  Stakeholder,
} from "@/lib/types";

const DECISIONS: { key: DecisionType; label: string; className: string }[] = [
  {
    key: "approve",
    label: "Approve evidence",
    className: "bg-emerald-600 text-white hover:bg-emerald-700",
  },
  {
    key: "request_more",
    label: "Request more evidence",
    className: "bg-amber-500 text-white hover:bg-amber-600",
  },
  { key: "reject", label: "Reject", className: "bg-white text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50" },
];

export function ReviewPanel({
  request,
  stakeholder,
  activity,
}: {
  request: EvidenceRequest;
  stakeholder: Stakeholder;
  activity: ActivityEntry[];
}) {
  const review = request.ai_review;
  const [activeFileId, setActiveFileId] = useState(request.files[0]?.id ?? null);
  const [mappedControls, setMappedControls] = useState<string[]>(
    review?.suggested_control_refs ?? [request.control_ref],
  );
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [recorded, setRecorded] = useState<DecisionType | null>(null);

  const activeFile = request.files.find((f) => f.id === activeFileId) ?? null;

  function toggleFlag(id: string) {
    setSelectedFlags((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  }

  /** Turns the flags the auditor ticked into the body of the follow-up message. */
  function draftFromFlags() {
    if (!review) return;
    const picked = review.flags.filter((f) => selectedFlags.includes(f.id));
    if (picked.length === 0) return;
    setNote(
      `To close out this request, please provide the following:\n\n` +
        picked.map((f, i) => `${i + 1}. ${f.title} — ${f.detail}`).join("\n\n"),
    );
  }

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        {/* Files */}
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold">
              Submitted evidence
              <span className="ml-1.5 font-normal text-slate-500">({request.files.length})</span>
            </h2>
            <span className="text-xs text-slate-500">
              Uploaded by {stakeholder.full_name} · {stakeholder.role_title}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {request.files.map((f) => {
              const analysed = review?.evidence_file_id === f.id;
              return (
                <li key={f.id}>
                  <button
                    onClick={() => setActiveFileId(f.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                      activeFileId === f.id ? "bg-slate-50" : ""
                    }`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                      {f.filename.split(".").pop()?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{f.filename}</span>
                      <span className="block text-xs text-slate-500">
                        {formatBytes(f.size_bytes)}
                        {f.page_count ? ` · ${f.page_count} pages` : ""} ·{" "}
                        {formatDateTime(f.uploaded_at)}
                      </span>
                    </span>
                    {analysed ? (
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200 ring-inset">
                        AI analysed
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Not analysed</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {activeFile && (
            <div className="flex h-40 items-center justify-center border-t border-slate-200 bg-slate-50 text-sm text-slate-400">
              Document preview — {activeFile.filename}
            </div>
          )}
        </section>

        {/* AI analysis */}
        {review ? (
          <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">AI analysis</h2>
                <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200 ring-inset">
                  Suggestion only
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {review.model} · {relativeTime(review.reviewed_at)}
              </span>
            </div>

            <div className="space-y-5 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Assessed completeness">
                  <CompletenessBadge value={review.completeness} withBar />
                </Field>
                <Field label="Classified document type">
                  <p className="text-sm font-medium">{review.doc_type}</p>
                  {review.doc_type_alternatives.length > 0 && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Also considered: {review.doc_type_alternatives.join(", ")}
                    </p>
                  )}
                </Field>
              </div>

              <Field label="Summary">
                <p className="text-sm leading-relaxed text-slate-700">{review.summary}</p>
              </Field>

              <Field label="Suggested control mapping">
                <div className="flex flex-wrap items-center gap-2">
                  {review.suggested_control_refs.map((ref) => {
                    const on = mappedControls.includes(ref);
                    return (
                      <button
                        key={ref}
                        onClick={() =>
                          setMappedControls((prev) =>
                            on ? prev.filter((c) => c !== ref) : [...prev, ref],
                          )
                        }
                        className={`rounded-full px-2.5 py-1 font-mono text-xs font-medium ring-1 ring-inset transition ${
                          on
                            ? "bg-slate-900 text-white ring-slate-900"
                            : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {on ? "✓ " : "+ "}
                        {ref}
                      </button>
                    );
                  })}
                  <span className="text-xs text-slate-500">
                    {mappedControls.length === 0
                      ? "No controls mapped"
                      : `Mapped to ${mappedControls.join(", ")}`}
                  </span>
                </div>
              </Field>

              {review.flags.length > 0 && (
                <Field label={`Flags (${review.flags.length})`}>
                  <p className="mb-2 text-xs text-slate-500">
                    Tick the items you want the stakeholder to address, then draft the follow-up.
                  </p>
                  <ul className="space-y-2">
                    {review.flags.map((f) => {
                      const s = severityStyle(f.severity);
                      const checked = selectedFlags.includes(f.id);
                      return (
                        <li key={f.id}>
                          <label
                            className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${s.chip} ${
                              checked ? "ring-1 ring-slate-400" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFlag(f.id)}
                              className="mt-0.5 size-4 shrink-0 accent-slate-900"
                            />
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
                                <span className="text-sm font-medium">{f.title}</span>
                                <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                                  {s.label}
                                </span>
                              </span>
                              <span className="mt-1 block text-sm text-slate-600">{f.detail}</span>
                              {f.location && (
                                <span className="mt-1 block font-mono text-[11px] text-slate-500">
                                  {f.location}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    onClick={draftFromFlags}
                    disabled={selectedFlags.length === 0}
                    className="mt-3 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Draft follow-up from {selectedFlags.length || "selected"} flag
                    {selectedFlags.length === 1 ? "" : "s"}
                  </button>
                </Field>
              )}

              {review.excerpts.length > 0 && (
                <Field label="Source excerpts">
                  <p className="mb-2 text-xs text-slate-500">
                    What the model actually read. Every conclusion above should trace back to one of these.
                  </p>
                  <ul className="space-y-2">
                    {review.excerpts.map((e) => (
                      <li
                        key={e.location}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3"
                      >
                        <p className="font-mono text-[11px] text-slate-500">{e.location}</p>
                        <p className="mt-1 text-sm text-slate-700 italic">&ldquo;{e.text}&rdquo;</p>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              {request.files.length > 0 ? "AI analysis in progress…" : "No evidence uploaded yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {request.files.length > 0
                ? "Extraction, classification, and control mapping usually take under a minute."
                : `Waiting on ${stakeholder.full_name}. The upload link was emailed and does not require a login.`}
            </p>
          </section>
        )}
      </div>

      {/* Decision + activity */}
      <aside className="space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white xl:sticky xl:top-20">
          <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold">
            Your decision
          </h2>
          <div className="space-y-3 p-4">
            {request.decision && !recorded && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">
                  Previously {DECISION_LABEL[request.decision.decision].toLowerCase()} by{" "}
                  {request.decision.decided_by} · {formatDateTime(request.decision.decided_at)}
                </p>
                <p className="mt-1 text-sm text-slate-700">{request.decision.note}</p>
              </div>
            )}

            {recorded ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-800">
                  {DECISION_LABEL[recorded]} (prototype — nothing was saved)
                </p>
                <button
                  onClick={() => setRecorded(null)}
                  className="mt-2 text-xs font-medium text-emerald-800 underline"
                >
                  Undo
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={6}
                  placeholder="Note to the stakeholder or to the file. This is written to the audit trail."
                  className="w-full resize-y rounded-md border border-slate-200 p-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
                />
                <div className="space-y-2">
                  {DECISIONS.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setRecorded(d.key)}
                      className={`w-full rounded-md px-3 py-2 text-sm font-medium transition ${d.className}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Approving records your name, the mapped controls ({mappedControls.join(", ") || "none"}
                  ), and this note to the activity log.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-semibold">Activity</h2>
          <ol className="space-y-3 p-4">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    a.actor_type === "ai"
                      ? "bg-violet-500"
                      : a.actor_type === "auditor"
                        ? "bg-slate-900"
                        : a.actor_type === "stakeholder"
                          ? "bg-sky-500"
                          : "bg-slate-300"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{a.action}</p>
                  {a.detail && <p className="text-xs text-slate-600">{a.detail}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.actor} · {formatDateTime(a.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      {children}
    </div>
  );
}
