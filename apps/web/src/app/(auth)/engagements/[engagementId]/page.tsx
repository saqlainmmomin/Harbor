import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard";
import { fetchEngagement, fetchEngagementRequests, fetchEngagementActivity } from "@/lib/api";

export default async function EvidenceDashboardPage(props: PageProps<"/engagements/[engagementId]">) {
  const { engagementId } = await props.params;

  const [engagement, user] = await Promise.all([fetchEngagement(engagementId), currentUser()]);
  if (!engagement) notFound();

  const [{ requests, stakeholders }, activity] = await Promise.all([
    fetchEngagementRequests(engagementId),
    fetchEngagementActivity(engagementId),
  ]);

  const greetingName = user?.firstName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "there";

  return (
    <main className="bg-[var(--bg)] p-7">
      {/* No "New request" / "Send reminders" header actions -- there's no
          create-request or reminder-sending API yet, and a button that
          silently does nothing on click is worse than no button. */}
      <OverviewDashboard
        requests={requests}
        stakeholders={stakeholders}
        engagementId={engagementId}
        activity={activity}
        greetingName={greetingName}
      />
    </main>
  );
}
