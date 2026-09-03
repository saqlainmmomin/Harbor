import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { fetchEngagement } from "@/lib/api";
import { formatPeriod, FRAMEWORK_LABEL } from "@/lib/format";
import type { CompanySize } from "@/lib/types";

const COMPANY_SIZE_LABEL: Record<CompanySize, string> = {
  startup: "Startup",
  smb: "SMB",
  mid_market: "Mid-market",
  enterprise: "Enterprise (5,000+)",
};

// Real data only -- account fields come from the signed-in Clerk user,
// engagement fields from the database. There's no settings-write API yet
// (notification preferences, team members, integrations config), so those
// sections say so plainly instead of rendering inert toggles.
export default async function SettingsPage(props: PageProps<"/engagements/[engagementId]/settings">) {
  const { engagementId } = await props.params;

  const [engagement, user] = await Promise.all([fetchEngagement(engagementId), currentUser()]);
  if (!engagement) notFound();

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Not set";
  const email = user?.primaryEmailAddress?.emailAddress ?? "Not set";

  return (
    <main className="bg-[var(--bg)] p-7">
      <h1 className="mb-6 text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">Settings</h1>

      <div className="flex max-w-2xl flex-col gap-6">
        <Section title="Account">
          <Row label="Name" value={name} />
          <Row label="Email" value={email} />
          <Row label="User ID" value={user?.id ?? "Not set"} mono />
        </Section>

        <Section title="Engagement">
          <Row label="Client" value={engagement.client_name} />
          <Row label="Engagement" value={engagement.name} />
          <Row
            label="Frameworks"
            value={engagement.frameworks.map((f) => FRAMEWORK_LABEL[f]).join(", ") || "Not set"}
          />
          {engagement.industry && <Row label="Industry" value={engagement.industry} />}
          {engagement.company_size && <Row label="Company size" value={COMPANY_SIZE_LABEL[engagement.company_size]} />}
          <Row label="Period" value={formatPeriod(engagement.period_start, engagement.period_end)} />
          <Row label="Lead auditor" value={engagement.lead_auditor} />
        </Section>
        {engagement.description && (
          <Section title="Description">
            <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">{engagement.description}</p>
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-base leading-tight font-bold text-[var(--ink)]">{title}</h2>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-[var(--ink-muted)]">{label}</span>
      <span className={`truncate text-sm font-medium text-[var(--ink)] ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
