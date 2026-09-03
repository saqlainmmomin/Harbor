"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/requests/add-stakeholder-form";
import {
  bulkCreateEvidenceRequests,
  fetchScopeQuestions,
  generateRfiDraft,
  submitEngagementScope,
} from "@/lib/api";
import type {
  EngagementScope,
  RfiDraftRow,
  ScopeAnswers,
  ScopeAnswerValue,
  ScopeFramework,
  ScopeQuestion,
  Stakeholder,
} from "@/lib/types";

// Deliberately separate from the existing engagement-creation `Framework`
// picker (SOC2/ISO27001, in new-engagement-form.tsx) -- this feature offers
// exactly these three, no SOC2. `slug` is the id the backend registers the
// framework's scope-questions endpoint under (GET /frameworks/{slug}/scope-questions).
const SCOPE_FRAMEWORKS: { key: ScopeFramework; slug: string; label: string }[] = [
  { key: "ISO27001", slug: "iso27001", label: "ISO 27001" },
  { key: "NIST_CSF", slug: "nist_csf", label: "NIST CSF" },
  { key: "PCI_DSS", slug: "pci_dss", label: "PCI-DSS" },
];

type Step = "frameworks" | "questions" | "checklist" | "rfi-draft";

let rowKeySeq = 0;
function nextRowKey() {
  rowKeySeq += 1;
  return `row_${rowKeySeq}`;
}

export function ScopeWorkflow({
  engagementId,
  initialScope,
  stakeholders,
}: {
  engagementId: string;
  initialScope: EngagementScope | null;
  stakeholders: Stakeholder[];
}) {
  const router = useRouter();
  // Skip straight to the checklist if scope was already computed for this
  // engagement -- see ScopePage's comment.
  const [step, setStep] = useState<Step>(initialScope ? "checklist" : "frameworks");
  const [frameworks, setFrameworks] = useState<ScopeFramework[]>([]);
  const [questionsByFramework, setQuestionsByFramework] = useState<Record<string, ScopeQuestion[]>>({});
  const [answers, setAnswers] = useState<ScopeAnswers>({} as ScopeAnswers);
  const [scope, setScope] = useState<EngagementScope | null>(initialScope);
  const [draftRows, setDraftRows] = useState<RfiDraftRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFramework(key: ScopeFramework) {
    setFrameworks((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  async function handlePickFrameworks() {
    if (frameworks.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        frameworks.map(async (fw) => {
          const meta = SCOPE_FRAMEWORKS.find((f) => f.key === fw)!;
          const questions = await fetchScopeQuestions(meta.slug);
          return [fw, questions] as const;
        }),
      );
      const byFramework: Record<string, ScopeQuestion[]> = {};
      for (const [fw, questions] of entries) byFramework[fw] = questions;
      const missing = entries.filter(([, qs]) => qs.length === 0).map(([fw]) => fw);
      if (missing.length === entries.length) {
        setError(
          "Could not load scope questions for the selected framework(s). The backend endpoint may not be up yet.",
        );
        setLoading(false);
        return;
      }
      setQuestionsByFramework(byFramework);
      const initialAnswers = {} as ScopeAnswers;
      for (const fw of frameworks) initialAnswers[fw] = {};
      setAnswers(initialAnswers);
      setStep("questions");
    } finally {
      setLoading(false);
    }
  }

  function setAnswer(fw: ScopeFramework, questionId: string, value: ScopeAnswerValue) {
    setAnswers((prev) => ({ ...prev, [fw]: { ...prev[fw], [questionId]: value } }));
  }

  async function handleSubmitScope() {
    setLoading(true);
    setError(null);
    const result = await submitEngagementScope(engagementId, frameworks, answers);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setScope(result.scope);
    setStep("checklist");
  }

  async function handleGenerateRfi() {
    setLoading(true);
    setError(null);
    const items = await generateRfiDraft(engagementId);
    setLoading(false);
    if (items.length === 0) {
      setError(
        "Generating the RFI draft returned no items. Either every applicable control already has a request, or the backend endpoint isn't up yet -- add rows manually below.",
      );
    }
    setDraftRows(
      items.map((item) => ({
        key: nextRowKey(),
        control_ref: item.control_ref,
        title: item.title,
        description: item.description,
        stakeholder_id: stakeholders[0]?.id ?? "",
        due_date: item.due_date ?? "",
      })),
    );
    setStep("rfi-draft");
  }

  function updateRow(key: string, patch: Partial<RfiDraftRow>) {
    setDraftRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setDraftRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addManualRow() {
    setDraftRows((prev) => [
      ...prev,
      {
        key: nextRowKey(),
        control_ref: "",
        title: "",
        description: "",
        stakeholder_id: stakeholders[0]?.id ?? "",
        due_date: "",
      },
    ]);
  }

  async function handleBulkCreate() {
    setLoading(true);
    setError(null);
    const result = await bulkCreateEvidenceRequests(
      engagementId,
      draftRows.map((r) => ({
        stakeholder_id: r.stakeholder_id,
        control_ref: r.control_ref,
        title: r.title,
        description: r.description,
        due_date: r.due_date,
      })),
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
    router.push(`/engagements/${engagementId}/requests`);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <StepIndicator step={step} />

      {error && (
        <p className="rounded-md border border-[var(--status-rose-ring)] bg-[var(--status-rose-bg)] px-3 py-2 text-sm font-medium text-[var(--status-rose-ink)]">
          {error}
        </p>
      )}

      {step === "frameworks" && (
        <section className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-sm font-bold text-[var(--ink)]">Frameworks in scope</h2>
          <div className="flex flex-wrap gap-2">
            {SCOPE_FRAMEWORKS.map((fw) => {
              const on = frameworks.includes(fw.key);
              return (
                <button
                  key={fw.key}
                  type="button"
                  onClick={() => toggleFramework(fw.key)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                    on
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] ring-[var(--accent)]"
                      : "bg-[var(--surface)] text-[var(--ink-secondary)] ring-[var(--border-strong)] hover:bg-[var(--surface-raised)]"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {fw.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={handlePickFrameworks}
            disabled={frameworks.length === 0 || loading}
            className="mt-5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-50"
          >
            {loading ? "Loading questions…" : "Continue"}
          </button>
        </section>
      )}

      {step === "questions" && (
        <section className="space-y-5">
          {frameworks.map((fw) => {
            const meta = SCOPE_FRAMEWORKS.find((f) => f.key === fw)!;
            const questions = questionsByFramework[fw] ?? [];
            return (
              <div key={fw} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
                <h2 className="mb-4 text-sm font-bold text-[var(--ink)]">{meta.label} scope questions</h2>
                {questions.length === 0 && (
                  <p className="text-sm text-[var(--ink-muted)]">No scope questions returned for this framework.</p>
                )}
                <div className="space-y-4">
                  {questions.map((q) => (
                    <FormField key={q.id} label={q.question} className="block">
                      {q.help_text && <p className="mb-1.5 text-xs text-[var(--ink-faint)]">{q.help_text}</p>}
                      {q.type === "single_select" ? (
                        <select
                          value={(answers[fw]?.[q.id] as string) ?? ""}
                          onChange={(e) => setAnswer(fw, q.id, e.target.value)}
                          className="w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                        >
                          <option value="">Select…</option>
                          {q.options.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((o) => {
                            const current = (answers[fw]?.[q.id] as string[]) ?? [];
                            const on = current.includes(o.value);
                            return (
                              <button
                                key={o.value}
                                type="button"
                                onClick={() =>
                                  setAnswer(
                                    fw,
                                    q.id,
                                    on ? current.filter((v) => v !== o.value) : [...current, o.value],
                                  )
                                }
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                                  on
                                    ? "bg-[var(--accent)] text-[var(--accent-ink)] ring-[var(--accent)]"
                                    : "bg-[var(--surface)] text-[var(--ink-secondary)] ring-[var(--border-strong)] hover:bg-[var(--surface-raised)]"
                                }`}
                              >
                                {on ? "✓ " : "+ "}
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </FormField>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <button
              onClick={handleSubmitScope}
              disabled={loading}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-50"
            >
              {loading ? "Computing scope…" : "See evidence checklist"}
            </button>
            <button
              type="button"
              onClick={() => setStep("frameworks")}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              Back
            </button>
          </div>
        </section>
      )}

      {step === "checklist" && scope && (
        <section className="space-y-4">
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-3 text-sm font-bold text-[var(--ink)]">
              Evidence checklist
              <span className="ml-1.5 font-normal text-[var(--ink-muted)]">({scope.evidence_checklist.length})</span>
            </h2>
            {scope.evidence_checklist.length === 0 ? (
              <p className="text-sm text-[var(--ink-muted)]">
                No checklist items came back. The backend scope endpoint may not be up yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {scope.evidence_checklist.map((item, i) => (
                  <li key={`${item.document_type}_${i}`} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--ink)]">{item.label}</p>
                      {item.required ? (
                        <span className="rounded bg-[var(--status-amber-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-amber-ink)] ring-1 ring-inset ring-[var(--status-amber-ring)]">
                          Required
                        </span>
                      ) : (
                        <span className="rounded bg-[var(--status-neutral-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-neutral-ink)] ring-1 ring-inset ring-[var(--status-neutral-ring)]">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[var(--ink-secondary)]">{item.reason}</p>
                    {item.maps_to.length > 0 && (
                      <p className="mt-1 font-mono text-xs text-[var(--ink-faint)]">Maps to: {item.maps_to.join(", ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {scope.excluded_controls.length > 0 && (
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="mb-3 text-sm font-bold text-[var(--ink)]">
                Excluded controls
                <span className="ml-1.5 font-normal text-[var(--ink-muted)]">({scope.excluded_controls.length})</span>
              </h2>
              <ul className="space-y-1.5">
                {scope.excluded_controls.map((c) => (
                  <li key={c.id} className="text-sm text-[var(--ink-secondary)]">
                    <span className="font-mono text-xs text-[var(--ink-faint)]">{c.id}</span> — {c.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleGenerateRfi}
            disabled={loading}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate RFI draft"}
          </button>
        </section>
      )}

      {step === "rfi-draft" && (
        <section className="space-y-4">
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
              <h2 className="text-sm font-bold text-[var(--ink)]">
                RFI draft
                <span className="ml-1.5 font-normal text-[var(--ink-muted)]">({draftRows.length} items)</span>
              </h2>
              <button
                type="button"
                onClick={addManualRow}
                className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
              >
                + Add row
              </button>
            </div>
            {draftRows.length === 0 ? (
              <p className="p-4 text-sm text-[var(--ink-muted)]">
                No draft items. Add a row manually, or go back and generate again.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {draftRows.map((row) => (
                  <li key={row.key} className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-3">
                      <FormField label="Control" className="w-32">
                        <input
                          type="text"
                          value={row.control_ref}
                          onChange={(e) => updateRow(row.key, { control_ref: e.target.value })}
                          placeholder="A.5.1"
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
                        />
                      </FormField>
                      <FormField label="Title" className="min-w-56 flex-1">
                        <input
                          type="text"
                          value={row.title}
                          onChange={(e) => updateRow(row.key, { title: e.target.value })}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                        />
                      </FormField>
                      <FormField label="Stakeholder" className="min-w-40">
                        <select
                          value={row.stakeholder_id}
                          onChange={(e) => updateRow(row.key, { stakeholder_id: e.target.value })}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                        >
                          <option value="">Select…</option>
                          {stakeholders.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Due date" className="w-40">
                        <input
                          type="date"
                          value={row.due_date}
                          onChange={(e) => updateRow(row.key, { due_date: e.target.value })}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                        />
                      </FormField>
                    </div>
                    <FormField label="Description">
                      <textarea
                        rows={2}
                        value={row.description}
                        onChange={(e) => updateRow(row.key, { description: e.target.value })}
                        className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                      />
                    </FormField>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--status-rose-ink)] transition-colors hover:bg-[var(--status-rose-bg)]"
                    >
                      Remove row
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkCreate}
              disabled={
                loading ||
                draftRows.length === 0 ||
                draftRows.some((r) => !r.control_ref || !r.title || !r.stakeholder_id || !r.due_date)
              }
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-50"
            >
              {loading ? "Creating…" : `Create ${draftRows.length} request${draftRows.length === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={() => setStep("checklist")}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
            >
              Back
            </button>
          </div>
          {draftRows.some((r) => !r.stakeholder_id) && (
            <p className="text-xs text-[var(--ink-faint)]">Every row needs a stakeholder and a due date before you can create the requests.</p>
          )}
        </section>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "frameworks", label: "Frameworks" },
    { key: "questions", label: "Scope questions" },
    { key: "checklist", label: "Checklist" },
    { key: "rfi-draft", label: "RFI draft" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--ink-faint)]">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 ring-1 ring-inset ${
              i === activeIndex
                ? "bg-[var(--accent)] text-[var(--accent-ink)] ring-[var(--accent)]"
                : i < activeIndex
                  ? "bg-[var(--status-emerald-bg)] text-[var(--status-emerald-ink)] ring-[var(--status-emerald-ring)]"
                  : "bg-[var(--surface)] text-[var(--ink-faint)] ring-[var(--border)]"
            }`}
          >
            {i + 1}. {s.label}
          </span>
          {i < steps.length - 1 && <span aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  );
}
