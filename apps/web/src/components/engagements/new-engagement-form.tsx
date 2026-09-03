"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createEngagement } from "@/lib/api";
import { Logo } from "@/components/logo";
import type { CompanySize, Framework } from "@/lib/types";

const INDUSTRIES = ["Fintech", "Healthcare", "SaaS", "Retail", "Other"];
const COMPANY_SIZES: { value: CompanySize; label: string }[] = [
  { value: "startup", label: "Startup" },
  { value: "smb", label: "SMB" },
  { value: "mid_market", label: "Mid-market" },
  { value: "enterprise", label: "Enterprise (5,000+)" },
];

// Matches the backend's VALID_FRAMEWORKS exactly (see apps/api/app/main.py)
// -- SOC2 was dropped, NIST CSF and PCI-DSS are fully supported (not
// "coming soon"; that used to be inaccurate the moment the backend session
// shipped their framework definitions).
const FRAMEWORKS: { key: Framework; label: string; enabled: true }[] = [
  { key: "ISO27001", label: "ISO 27001", enabled: true },
  { key: "NIST_CSF", label: "NIST CSF", enabled: true },
  { key: "PCI_DSS", label: "PCI-DSS", enabled: true },
];
const FRAMEWORKS_COMING_SOON = ["GDPR", "HIPAA", "SOC 2", "India DPDPA"];

export function NewEngagementForm({ leadAuditorName }: { leadAuditorName: string }) {
  const router = useRouter();
  const [frameworks, setFrameworks] = useState<Framework[]>(["ISO27001"]);
  const [clientName, setClientName] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState<CompanySize | "">("");
  const [description, setDescription] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFramework(key: Framework) {
    setFrameworks((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (frameworks.length === 0) {
      setError("Select at least one framework.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createEngagement({
      client_name: clientName,
      name,
      industry,
      company_size: companySize as CompanySize,
      description: description || undefined,
      frameworks,
      period_start: periodStart,
      period_end: periodEnd,
      lead_auditor: leadAuditorName,
    });
    if (result.ok) {
      // Straight to Requests with the onboarding flag, not the Overview
      // dashboard -- a brand-new engagement's Overview is all zeroes with
      // no visible next step ("where do I upload my evidence?"). Requests
      // is where + Add stakeholder / + New request actually live, and
      // ?onboarding=1 auto-opens the first one (see RequestsToolbar).
      router.push(`/engagements/${result.engagement.id}/requests?onboarding=1`);
      return;
    }
    setSubmitting(false);
    setError(result.message);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="flex h-14 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-6">
        {/* "/", not a hardcoded engagement id -- this form can be the very
            first thing a signed-in visitor sees (see .env.local's sign-in
            redirect), before any engagement exists to link back to. */}
        <Link href="/" className="flex items-center">
          <Logo className="text-lg leading-none" />
        </Link>
        <span className="text-[var(--ink-faint)]">/</span>
        <p className="text-sm font-medium text-[var(--ink)]">New engagement</p>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">New engagement</h1>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
          Set up a client engagement: company details, scope, and the frameworks it&apos;s being assessed against.
        </p>

        {/* Company details */}
        <section className="mt-8 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-base font-bold text-[var(--ink)]">Company details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Northwind Logistics, Inc."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
              />
            </Field>
            <Field label="Engagement name" required>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ISO 27001, FY26"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
              />
            </Field>
            <Field label="Industry" required>
              <select
                required
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              >
                <option value="" disabled>
                  Select industry
                </option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Company size" required>
              <select
                required
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value as CompanySize)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              >
                <option value="" disabled>
                  Select company size
                </option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Description" hint="Optional">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this company does, and anything relevant to scoping this engagement."
                className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
              />
            </Field>
          </div>
        </section>

        {/* Frameworks */}
        <section className="mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-base font-bold text-[var(--ink)]">Compliance frameworks</h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Select every framework this engagement is being assessed against. An engagement can cover more than
            one.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {FRAMEWORKS.map((f) => {
              const checked = frameworks.includes(f.key);
              return (
                <label
                  key={f.key}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    checked
                      ? "border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--ink)]"
                      : "border-[var(--border)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFramework(f.key)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  {f.label}
                </label>
              );
            })}
            {FRAMEWORKS_COMING_SOON.map((label) => (
              <label
                key={label}
                className="relative flex cursor-not-allowed items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm font-medium text-[var(--ink-faint)]"
              >
                <input type="checkbox" disabled className="size-4 opacity-40" />
                {label}
                <span className="absolute -top-2 -right-2 rounded-full bg-[var(--border-strong)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--ink-secondary)]">
                  Coming soon
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Period + lead auditor */}
        <section className="mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-base font-bold text-[var(--ink)]">Engagement period</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Period start" required>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </Field>
            <Field label="Period end" required>
              <input
                type="date"
                required
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
            <span className="text-xs text-[var(--ink-muted)]">Lead auditor</span>
            <span className="text-sm font-medium text-[var(--ink)]">{leadAuditorName} (you)</span>
          </div>
        </section>

        {error && (
          <p className="mt-4 rounded-md border border-[var(--status-rose-ring)] bg-[var(--status-rose-bg)] px-3 py-2.5 text-sm font-medium text-[var(--status-rose-ink)]">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create engagement"}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--ink-secondary)]">
        {label}
        {required && <span className="text-[var(--status-rose-ink)]">*</span>}
        {hint && <span className="text-[var(--ink-faint)]">({hint})</span>}
      </span>
      {children}
    </label>
  );
}
