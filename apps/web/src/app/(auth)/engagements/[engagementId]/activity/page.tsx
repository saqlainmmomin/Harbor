import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { fetchEngagement, fetchEngagementActivity } from "@/lib/api";

export default async function ActivityPage(props: PageProps<"/engagements/[engagementId]/activity">) {
  const { engagementId } = await props.params;

  const engagement = await fetchEngagement(engagementId);
  if (!engagement) notFound();

  const activity = await fetchEngagementActivity(engagementId, 100);

  return (
    <main className="bg-[var(--bg)] p-7">
      <h1 className="mb-1 text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">Activity</h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">
        Every upload and AI review run across this engagement, logged as it happens.
      </p>
      <ActivityTimeline activity={activity} engagementId={engagementId} />
    </main>
  );
}
