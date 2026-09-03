"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CompletenessBadge, ComplianceStatusBadge, confidenceStyle, severityStyle } from "@/components/badges";
import { DECISION_LABEL, formatBytes, formatDateTime, relativeTime } from "@/lib/format";
import { analyzeEvidenceFile, fetchFilePreviewUrl, submitDecision, uploadEvidenceFile } from "@/lib/api";
import type {
  ActivityEntry,
  AiReview,
  DecisionType,
  EvidenceRequest,
  Stakeholder,
} from "@/lib/types";

const DECISIONS: { key: DecisionType; label: string; className: string }[] = [
  {
    key: "approve",
    label: "Approve evidence",
    className: "bg-[var(--status-emerald-dot)] text-white hover:-translate-y-px hover:brightness-110 hover:shadow-[var(--shadow-hover)]",
  },
  {
    key: "request_more",
    label: "Request more evidence",
    className: "bg-[var(--status-amber-dot)] text-white hover:-translate-y-px hover:brightness-110 hover:shadow-[var(--shadow-hover)]",
  },
  {
    key: "reject",
    label: "Reject",
    className:
      "bg-[var(--surface)] text-[var(--status-rose-ink)] ring-1 ring-inset ring-[var(--status-rose-ring)] hover:bg-[var(--status-rose-bg)] hover:ring-[var(--status-rose-ink)]",
  },
];

export function ReviewPanel({
  request,
  stakeholder,
  activity,
  decidedByName,
}: {
  request: EvidenceRequest;
  stakeholder: Stakeholder;
  activity: ActivityEntry[];
  /** Signed-in auditor's display name, real Clerk identity -- see
   * requests/[requestId]/page.tsx. Written to review_decisions.decided_by
   * on submit, so "Previously approved by ..." names an actual person. */
  decidedByName: string;
}) {
  const review = request.ai_review;
  const [activeFileId, setActiveFileId] = useState(request.files[0]?.id ?? null);
  const [mappedControls, setMappedControls] = useState<string[]>(
    review?.suggested_control_refs ?? [request.control_ref],
  );
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [decisionState, setDecisionState] = useState<"idle" | "submitting" | "error">("idle");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<"idle" | "analyzing" | "done" | "error">("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // Holds the just-analyzed result straight from POST /analyze's own
  // response. GET /evidence-requests/{id}/review (what router.refresh()
  // re-fetches server-side) doesn't surface compliance_status/current_state/
  // gap_description/evidence_quote/follow_up_evidence -- verified against
  // the real backend, those columns are only in the POST /analyze response,
  // not in that GET endpoint's response model. So the freshly analyzed
  // result is kept here and preferred for its file until a page navigation
  // clears it, rather than being lost the moment router.refresh() re-renders
  // with the GET endpoint's incomplete data.
  const [freshReview, setFreshReview] = useState<{ fileId: string; review: AiReview } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const activeFile = request.files.find((f) => f.id === activeFileId) ?? null;
  // The review the backend has on file isn't automatic any more (see
  // Analyze below) and is scoped to whichever file it was run against --
  // don't show a stale review for a different uploaded file. A fresh
  // in-memory result (see freshReview above) takes priority over the
  // server-fetched one for the same file, since it's guaranteed complete.
  const activeReview =
    freshReview && activeFile && freshReview.fileId === activeFile.id
      ? freshReview.review
      : review && activeFile && review.evidence_file_id === activeFile.id
        ? review
        : null;

  // Replaces the old "AI analysis fires automatically on upload" flow --
  // POST /evidence-files/{id}/analyze, then router.refresh() so status/
  // activity update server-side (same pattern as handleFileSelected/
  // handleDecision below); the parsed result itself is rendered immediately
  // from the response body (see freshReview above), not re-fetched.
  async function handleAnalyze() {
    if (!activeFile) return;
    setAnalysisState("analyzing");
    setAnalysisError(null);
    const result = await analyzeEvidenceFile(activeFile.id);
    if (result.ok) {
      setAnalysisState("done");
      setFreshReview({ fileId: activeFile.id, review: result.review });
      router.refresh();
      return;
    }
    setAnalysisState("error");
    setAnalysisError(result.message);
  }

  // Real upload, same endpoint the public stakeholder link uses -- lets the
  // signed-in auditor attach evidence directly to a request instead of only
  // being able to wait on the emailed magic link.
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadState("uploading");
    setUploadError(null);
    const result = await uploadEvidenceFile(request.id, file);
    if (result.ok) {
      setUploadState("idle");
      router.refresh();
      return;
    }
    setUploadState("error");
    setUploadError(result.message);
  }

  // Real document preview via a short-lived Supabase signed URL -- this used
  // to be a static "Document preview — {filename}" placeholder box; nothing
  // in the app could actually show a file's content before this endpoint
  // existed (see SECURITY.md).
  useEffect(() => {
    if (!activeFileId) {
      setPreviewUrl(null);
      setPreviewState("idle");
      return;
    }
    let cancelled = false;
    setPreviewState("loading");
    fetchFilePreviewUrl(activeFileId).then((url) => {
      if (cancelled) return;
      if (url) {
        setPreviewUrl(url);
        setPreviewState("ready");
      } else {
        setPreviewUrl(null);
        setPreviewState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeFileId]);

  function toggleFlag(id: string) {
    setSelectedFlags((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  }

  // Real persistence -- POST /evidence-requests/{id}/decision. Used to be
  // setRecorded(d.key) only, a local flag the UI itself labeled "prototype
  // — nothing was saved." router.refresh() re-fetches the request server
  // side, so what renders after this is the real persisted decision and
  // status, not an optimistic guess.
  async function handleDecision(decision: DecisionType) {
    setDecisionState("submitting");
    setDecisionError(null);
    const result = await submitDecision(request.id, { decision, note, decided_by: decidedByName });
    if (result.ok) {
      setDecisionState("idle");
      router.refresh();
      return;
    }
    setDecisionState("error");
    setDecisionError(result.message);
  }

  /** Turns the flags the auditor ticked into the body of the follow-up message. */
  function draftFromFlags() {
    if (!review) return;
    const picked = review.flags.filter((f) => selectedFlags.includes(f.id));
    if (picked.length === 0) return;
    setNote(
      `To close out this request, please provide the following:\n\n` +
        picked.map((f, i) => `${i + 1}. ${f.title}: ${f.detail}`).join("\n\n"),
    );
  }

  return (
    <div className="grid gap-6 p-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        {/* Files */}
        <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
            <h2 className="text-sm font-bold text-[var(--ink)]">
              Submitted evidence
              <span className="ml-1.5 font-normal text-[var(--ink-muted)]">({request.files.length})</span>
            </h2>
            <div className="flex items-center gap-3">
              {request.files.length > 0 && (
                <span className="text-xs text-[var(--ink-muted)]">
                  Uploaded by {stakeholder.full_name} · {stakeholder.role_title}
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState === "uploading"}
                className="rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-60"
              >
                {uploadState === "uploading" ? "Uploading…" : "Add evidence"}
              </button>
            </div>
          </div>
          {uploadState === "error" && uploadError && (
            <p className="border-b border-[var(--status-rose-ring)] bg-[var(--status-rose-bg)] px-4 py-2 text-xs font-medium text-[var(--status-rose-ink)]">
              {uploadError}
            </p>
          )}
          <ul className="divide-y divide-[var(--border)]">
            {request.files.map((f) => {
              const analysed = review?.evidence_file_id === f.id;
              return (
                <li key={f.id}>
                  <button
                    onClick={() => setActiveFileId(f.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-raised)] ${
                      activeFileId === f.id ? "bg-[var(--surface-raised)]" : ""
                    }`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded bg-[var(--surface-raised)] text-[10px] font-bold text-[var(--ink-faint)]">
                      {f.filename.split(".").pop()?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--ink)]">{f.filename}</span>
                      <span className="block text-xs text-[var(--ink-faint)]">
                        {formatBytes(f.size_bytes)}
                        {f.page_count ? ` · ${f.page_count} pages` : ""} ·{" "}
                        {formatDateTime(f.uploaded_at)}
                      </span>
                    </span>
                    {analysed ? (
                      <span className="rounded bg-[var(--status-violet-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-violet-ink)] ring-1 ring-inset ring-[var(--status-violet-ring)]">
                        AI analysed
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--ink-faint)]">Not analysed</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {activeFile && (
            <div className="border-t border-[var(--border)]">
              {previewState === "loading" && (
                <div className="skeleton relative flex h-96 items-center justify-center" role="status">
                  <span className="rounded-full bg-[var(--surface)]/80 px-3 py-1 text-xs text-[var(--ink-faint)]">
                    Loading preview…
                  </span>
                </div>
              )}
              {previewState === "error" && (
                <div className="flex h-40 flex-col items-center justify-center gap-1 bg-[var(--surface-raised)] text-sm text-[var(--ink-faint)]">
                  <p>Couldn&apos;t load a preview for {activeFile.filename}.</p>
                  <p className="text-xs">The file is still on record. This is just the preview failing.</p>
                </div>
              )}
              {previewState === "ready" && previewUrl && (
                <embed
                  src={previewUrl}
                  type="application/pdf"
                  className="h-[600px] w-full bg-[var(--surface-raised)]"
                  aria-label={`Preview of ${activeFile.filename}`}
                />
              )}
            </div>
          )}
        </section>

        {/* AI analysis */}
        {activeReview ? (
          <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--ink)]">AI analysis</h2>
                <span className="rounded bg-[var(--status-violet-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-violet-ink)] ring-1 ring-inset ring-[var(--status-violet-ring)]">
                  Suggestion only
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--ink-muted)]">
                  {review?.model} · {relativeTime(activeReview.reviewed_at)}
                </span>
                <button
                  onClick={handleAnalyze}
                  disabled={analysisState === "analyzing"}
                  title="Re-running replaces the result above."
                  className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {analysisState === "analyzing" ? "Analyzing…" : "Re-analyze"}
                </button>
              </div>
            </div>

            <div className="space-y-5 p-4">
              {analysisState === "error" && analysisError && (
                <p className="text-sm font-medium text-[var(--status-rose-ink)]">{analysisError}</p>
              )}

              {activeReview.compliance_status ? (
                // Control-aware analysis (POST /evidence-files/{id}/analyze) --
                // the field set this section renders now: a met/partial/not-met
                // verdict against the *specific* control this file was
                // requested for, not a generic document summary.
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Control status">
                      <ComplianceStatusBadge value={activeReview.compliance_status} withBar />
                      {activeReview.control_id_matched && (
                        <p className="mt-1 font-mono text-xs text-[var(--ink-faint)]">
                          Matched to {activeReview.control_id_matched}
                        </p>
                      )}
                    </Field>
                    {activeReview.risk_level && (
                      <Field label="Risk level">
                        <p className="text-sm font-medium text-[var(--ink)] capitalize">{activeReview.risk_level}</p>
                      </Field>
                    )}
                  </div>

                  {activeReview.current_state && (
                    <Field label="Current state">
                      <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">{activeReview.current_state}</p>
                    </Field>
                  )}

                  {activeReview.gap_description && (
                    <Field label="Gap">
                      <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">{activeReview.gap_description}</p>
                    </Field>
                  )}

                  {activeReview.evidence_quote && (
                    <Field label="Source excerpt">
                      <p className="mb-2 text-xs text-[var(--ink-muted)]">
                        What the model actually read. The verdict above should trace back to this.
                      </p>
                      <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                        <p className="text-sm text-[var(--ink-secondary)] italic">&ldquo;{activeReview.evidence_quote}&rdquo;</p>
                      </div>
                    </Field>
                  )}

                  {activeReview.follow_up_evidence && (
                    // The field the auditor most needs -- what to actually go
                    // collect next -- so it gets its own visually distinct
                    // block instead of being buried among the read-only fields.
                    <Field label="What to collect next">
                      <div className="rounded-md border border-[var(--status-amber-ring)] bg-[var(--status-amber-bg)] p-3">
                        <p className="text-sm font-medium text-[var(--status-amber-ink)]">{activeReview.follow_up_evidence}</p>
                      </div>
                    </Field>
                  )}
                </>
              ) : (
                // Legacy fallback -- a review persisted before this endpoint
                // existed (or from mock-data). Same rendering as before.
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Assessed completeness">
                      <CompletenessBadge value={activeReview.completeness} withBar />
                    </Field>
                    <Field label="Classified document type">
                      <p className="text-sm font-medium text-[var(--ink)]">{activeReview.doc_type}</p>
                      {activeReview.doc_type_alternatives.length > 0 && (
                        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                          Also considered: {activeReview.doc_type_alternatives.join(", ")}
                        </p>
                      )}
                    </Field>
                  </div>

                  <Field label="Summary">
                    <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">{activeReview.summary}</p>
                  </Field>

                  <Field label="Suggested control mapping">
                    {activeReview.suggested_controls && activeReview.suggested_controls.length > 0 ? (
                      <div className="space-y-2">
                        {activeReview.suggested_controls.map((c, i) => {
                          const on = mappedControls.includes(c.control_name);
                          const cs = confidenceStyle(c.confidence_label);
                          return (
                            <div
                              key={`${c.control_name}-${i}`}
                              className="flex flex-wrap items-start gap-2 rounded-md border border-[var(--border)] p-2.5"
                            >
                              <button
                                onClick={() =>
                                  setMappedControls((prev) =>
                                    on
                                      ? prev.filter((x) => x !== c.control_name)
                                      : [...prev, c.control_name],
                                  )
                                }
                                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                                  on
                                    ? "bg-[var(--accent)] text-[var(--accent-ink)] ring-[var(--accent)]"
                                    : "bg-[var(--surface)] text-[var(--ink-secondary)] ring-[var(--border-strong)] hover:bg-[var(--surface-raised)]"
                                }`}
                              >
                                {on ? "✓ " : "+ "}
                                {c.control_name}
                              </button>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${cs.chip}`}
                              >
                                {cs.label}
                              </span>
                              <span className="w-full text-xs text-[var(--ink-muted)] sm:w-auto sm:flex-1">
                                {c.rationale}
                              </span>
                            </div>
                          );
                        })}
                        <p className="text-xs text-[var(--ink-muted)]">
                          {mappedControls.length === 0
                            ? "No controls mapped"
                            : `Mapped to ${mappedControls.join(", ")}`}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {activeReview.suggested_control_refs.map((ref) => {
                          const on = mappedControls.includes(ref);
                          return (
                            <button
                              key={ref}
                              onClick={() =>
                                setMappedControls((prev) =>
                                  on ? prev.filter((c) => c !== ref) : [...prev, ref],
                                )
                              }
                              className={`rounded-full px-2.5 py-1 font-mono text-xs font-medium ring-1 ring-inset transition-colors ${
                                on
                                  ? "bg-[var(--accent)] text-[var(--accent-ink)] ring-[var(--accent)]"
                                  : "bg-[var(--surface)] text-[var(--ink-muted)] ring-[var(--border-strong)] hover:bg-[var(--surface-raised)]"
                              }`}
                            >
                              {on ? "✓ " : "+ "}
                              {ref}
                            </button>
                          );
                        })}
                        <span className="text-xs text-[var(--ink-muted)]">
                          {mappedControls.length === 0
                            ? "No controls mapped"
                            : `Mapped to ${mappedControls.join(", ")}`}
                        </span>
                      </div>
                    )}
                  </Field>

                  {activeReview.flags.length > 0 && (
                    <Field label={`Flags (${activeReview.flags.length})`}>
                      <p className="mb-2 text-xs text-[var(--ink-muted)]">
                        Tick the items you want the stakeholder to address, then draft the follow-up.
                      </p>
                      <ul className="space-y-2">
                        {activeReview.flags.map((f) => {
                          const s = severityStyle(f.severity);
                          const checked = selectedFlags.includes(f.id);
                          return (
                            <li key={f.id}>
                              <label
                                className={`flex cursor-pointer gap-3 rounded-md border p-3 transition-colors ${s.chip} ${
                                  checked ? "ring-1 ring-[var(--border-strong)]" : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleFlag(f.id)}
                                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
                                />
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-2">
                                    <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
                                    <span className="text-sm font-medium text-[var(--ink)]">{f.title}</span>
                                    <span className="text-[11px] font-medium tracking-wide text-[var(--ink-faint)] uppercase">
                                      {s.label}
                                    </span>
                                  </span>
                                  <span className="mt-1 block text-sm text-[var(--ink-secondary)]">{f.detail}</span>
                                  {f.location && (
                                    <span className="mt-1 block font-mono text-[11px] text-[var(--ink-faint)]">
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
                        className="mt-3 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Draft follow-up from {selectedFlags.length || "selected"} flag
                        {selectedFlags.length === 1 ? "" : "s"}
                      </button>
                    </Field>
                  )}

                  {activeReview.excerpts.length > 0 && (
                    <Field label="Source excerpts">
                      <p className="mb-2 text-xs text-[var(--ink-muted)]">
                        What the model actually read. Every conclusion above should trace back to one of these.
                      </p>
                      <ul className="space-y-2">
                        {activeReview.excerpts.map((e) => (
                          <li
                            key={e.location}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3"
                          >
                            <p className="font-mono text-[11px] text-[var(--ink-faint)]">{e.location}</p>
                            <p className="mt-1 text-sm text-[var(--ink-secondary)] italic">&ldquo;{e.text}&rdquo;</p>
                          </li>
                        ))}
                      </ul>
                    </Field>
                  )}
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--ink-secondary)]">
              {activeFile
                ? "Not analyzed yet"
                : request.files.length > 0
                  ? "Select a file to analyze"
                  : "No evidence uploaded yet"}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {activeFile
                ? `Click Analyze to get a control-aware compliance verdict for ${activeFile.filename} against ${request.control_ref}.`
                : request.files.length === 0
                  ? `Waiting on ${stakeholder.full_name}, or upload it yourself below. The upload link was also emailed and does not require a login.`
                  : "Pick a file above to analyze it."}
            </p>
            {analysisState === "error" && analysisError && (
              <p className="mt-2 text-sm font-medium text-[var(--status-rose-ink)]">{analysisError}</p>
            )}
            {activeFile ? (
              <button
                onClick={handleAnalyze}
                disabled={analysisState === "analyzing"}
                className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-60"
              >
                {analysisState === "analyzing" ? "Analyzing…" : "Analyze"}
              </button>
            ) : (
              request.files.length === 0 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadState === "uploading"}
                  className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-60"
                >
                  {uploadState === "uploading" ? "Uploading…" : "Upload evidence"}
                </button>
              )
            )}
          </section>
        )}
      </div>

      {/* Decision + activity */}
      <aside className="space-y-5">
        <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] xl:sticky xl:top-20">
          <h2 className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
            Your decision
          </h2>
          <div className="space-y-3 p-4">
            {request.decision && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                <p className="text-xs font-medium text-[var(--ink-muted)]">
                  {DECISION_LABEL[request.decision.decision]} by{" "}
                  {request.decision.decided_by} · {formatDateTime(request.decision.decided_at)}
                </p>
                {request.decision.note && (
                  <p className="mt-1 text-sm text-[var(--ink-secondary)]">{request.decision.note}</p>
                )}
              </div>
            )}

            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={6}
                placeholder="Note to the stakeholder or to the file. This is written to the audit trail."
                disabled={decisionState === "submitting"}
                className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] disabled:opacity-60"
              />
              <div className="space-y-2">
                {DECISIONS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => handleDecision(d.key)}
                    disabled={decisionState === "submitting"}
                    className={`w-full rounded-md px-3 py-2 text-sm font-medium transition-[background-color,filter,transform,box-shadow,ring-color] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none ${d.className}`}
                  >
                    {decisionState === "submitting" ? "Saving…" : d.label}
                  </button>
                ))}
              </div>
              {decisionState === "error" && decisionError && (
                <p className="text-sm font-medium text-[var(--status-rose-ink)]">{decisionError}</p>
              )}
              <p className="text-xs text-[var(--ink-muted)]">
                {request.decision ? "Recording a new decision replaces the one above." : "Recording"} a decision
                writes your name, this note, and the request&apos;s new status to the audit trail.
              </p>
            </>
          </div>
        </section>

        <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          <h2 className="border-b border-[var(--border)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]">Activity</h2>
          {activity.length === 0 ? (
            <p className="p-4 text-sm text-[var(--ink-muted)]">Nothing logged for this request yet.</p>
          ) : (
            <ol className="space-y-3 p-4">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      a.actor_type === "ai"
                        ? "bg-[var(--status-violet-dot)]"
                        : a.actor_type === "auditor"
                          ? "bg-[var(--accent)]"
                          : a.actor_type === "stakeholder"
                            ? "bg-[var(--status-amber-dot)]"
                            : "bg-[var(--ink-faint)]"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)]">{a.action}</p>
                    {a.detail && <p className="text-xs text-[var(--ink-secondary)]">{a.detail}</p>}
                    <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
                      {a.actor} · {formatDateTime(a.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-[var(--ink-faint)] uppercase">{label}</p>
      {children}
    </div>
  );
}
