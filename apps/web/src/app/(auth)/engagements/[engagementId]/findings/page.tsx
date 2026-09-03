import { notFound } from "next/navigation";
import { FindingsList } from "@/components/findings/findings-list";
import { fetchEngagement, fetchEngagementRequests } from "@/lib/api";
import { potentialExceptions } from "@/lib/request-status";

export default async function FindingsPage(props: PageProps<"/engagements/[engagementId]/findings">) {
  const { engagementId } = await props.params;

  const engagement = await fetchEngagement(engagementId);
  if (!engagement) notFound();

  const { requests, stakeholders } = await fetchEngagementRequests(engagementId);
  const findings = potentialExceptions(requests);

  return (
    <main className="bg-[var(--bg)] p-7">
      <h1 className="mb-1 text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">Findings</h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">
        Everything the AI review has flagged across this engagement: the same flags shown on each request&apos;s
        review panel, gathered into one queue.
      </p>
      <FindingsList requests={findings} stakeholders={stakeholders} engagementId={engagementId} />
    </main>
  );
}
