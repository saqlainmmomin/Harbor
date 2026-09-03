import { notFound } from "next/navigation";
import { ScopeWorkflow } from "@/components/scope/scope-workflow";
import { fetchEngagement, fetchEngagementScope, fetchEngagementStakeholders } from "@/lib/api";

export default async function ScopePage(props: PageProps<"/engagements/[engagementId]/scope">) {
  const { engagementId } = await props.params;

  const engagement = await fetchEngagement(engagementId);
  if (!engagement) notFound();

  // Re-visiting after scope was already run: skip straight to the checklist
  // step instead of making the auditor answer the same questions again.
  const [existingScope, stakeholders] = await Promise.all([
    fetchEngagementScope(engagementId),
    fetchEngagementStakeholders(engagementId),
  ]);

  return (
    <main className="bg-[var(--bg)] p-7">
      <h1 className="mb-1 text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">Scope &amp; RFI</h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">
        Pick the frameworks in scope, answer a few questions about the environment, and turn the resulting evidence
        checklist into real requests.
      </p>
      <ScopeWorkflow engagementId={engagementId} initialScope={existingScope} stakeholders={stakeholders} />
    </main>
  );
}
