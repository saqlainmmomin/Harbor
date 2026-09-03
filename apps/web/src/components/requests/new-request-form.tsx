"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEvidenceRequest } from "@/lib/api";
import { FormField } from "@/components/requests/add-stakeholder-form";
import type { Stakeholder } from "@/lib/types";

export function NewRequestForm({
  engagementId,
  stakeholders,
  onDone,
}: {
  engagementId: string;
  stakeholders: Stakeholder[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [controlRef, setControlRef] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stakeholderId, setStakeholderId] = useState(stakeholders[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createEvidenceRequest({
      engagement_id: engagementId,
      stakeholder_id: stakeholderId,
      control_ref: controlRef,
      title,
      description,
      due_date: dueDate,
    });
    if (result.ok) {
      router.refresh();
      onDone();
      return;
    }
    setSubmitting(false);
    setError(result.message);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="flex flex-wrap gap-3">
        <FormField label="Control" required className="w-32">
          <input
            type="text"
            required
            value={controlRef}
            onChange={(e) => setControlRef(e.target.value)}
            placeholder="CC6.1"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
          />
        </FormField>
        <FormField label="Title" required className="min-w-56 flex-1">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Access control policy"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
          />
        </FormField>
        <FormField label="Owner" required className="min-w-40">
          <select
            required
            value={stakeholderId}
            onChange={(e) => setStakeholderId(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          >
            {stakeholders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Due date" required className="w-40">
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
          />
        </FormField>
      </div>
      <FormField label="Description" required>
        <textarea
          rows={2}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What evidence you need and why."
          className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
        />
      </FormField>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create request"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm font-medium text-[var(--status-rose-ink)]">{error}</p>}
    </form>
  );
}
