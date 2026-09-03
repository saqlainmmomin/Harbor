import { notFound } from "next/navigation";
import { ControlsTable } from "@/components/controls/controls-table";
import { fetchEngagement, fetchEngagementRequests } from "@/lib/api";
import { groupByControl } from "@/lib/request-status";

export default async function ControlsPage(props: PageProps<"/engagements/[engagementId]/controls">) {
  const { engagementId } = await props.params;

  const engagement = await fetchEngagement(engagementId);
  if (!engagement) notFound();

  const { requests } = await fetchEngagementRequests(engagementId);
  const groups = groupByControl(requests);

  return (
    <main className="bg-[var(--bg)] p-7">
      <h1 className="mb-1 text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">Controls</h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">
        Every control this engagement has requested evidence against, derived from real requests. Not a full
        control library, which isn&apos;t built yet.
      </p>
      <ControlsTable groups={groups} engagementId={engagementId} />
    </main>
  );
}
