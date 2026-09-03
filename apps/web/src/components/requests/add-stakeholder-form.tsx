"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStakeholder } from "@/lib/api";

export function AddStakeholderForm({
  engagementId,
  onDone,
}: {
  engagementId: string;
  /** Called on both success and Cancel -- `succeeded` distinguishes them,
   * since the onboarding chain in RequestsToolbar only wants to advance to
   * the next form on a real save, not on Cancel. */
  onDone: (succeeded?: boolean) => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createStakeholder(engagementId, { full_name: fullName, email, role_title: roleTitle });
    if (result.ok) {
      router.refresh();
      onDone(true);
      return;
    }
    setSubmitting(false);
    setError(result.message);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <FormField label="Name" required className="min-w-40 flex-1">
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Marcus Webb"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
        />
      </FormField>
      <FormField label="Email" required className="min-w-48 flex-1">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="m.webb@company.com"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
        />
      </FormField>
      <FormField label="Role" required className="min-w-36 flex-1">
        <input
          type="text"
          required
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder="IT Manager"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
        />
      </FormField>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add stakeholder"}
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
        >
          Cancel
        </button>
      </div>
      {error && <p className="w-full text-sm font-medium text-[var(--status-rose-ink)]">{error}</p>}
    </form>
  );
}

export function FormField({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-secondary)]">
        {label}
        {required && <span className="text-[var(--status-rose-ink)]">*</span>}
      </span>
      {children}
    </label>
  );
}
