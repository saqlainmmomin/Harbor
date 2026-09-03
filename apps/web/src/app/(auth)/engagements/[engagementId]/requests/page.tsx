import { notFound } from "next/navigation";
import { RequestsTable } from "@/components/dashboard/requests-table";
import { RequestsToolbar } from "@/components/requests/requests-toolbar";
import { fetchEngagement, fetchEngagementRequests, fetchEngagementStakeholders } from "@/lib/api";

export default async function RequestsPage(props: PageProps<"/engagements/[engagementId]/requests">) {
  const { engagementId } = await props.params;
  const searchParams = await props.searchParams;
  const initialQuery = typeof searchParams.q === "string" ? searchParams.q : "";
  // Set by NewEngagementForm's post-create redirect -- lands a just-created
  // engagement straight into "add your first stakeholder" instead of an
  // empty dashboard with no visible way to get evidence in. Gated on there
  // actually being nothing yet below, so a stale/shared ?onboarding=1 link
  // to an engagement that already has stakeholders won't re-trigger it.
  const onboarding = searchParams.onboarding === "1";

  const engagement = await fetchEngagement(engagementId);
  if (!engagement) notFound();

  // fetchEngagementRequests' stakeholders are only the ones with a request
  // already touching them (joined off evidence_requests) -- a freshly added
  // stakeholder with zero requests wouldn't show up there, so the "New
  // request" form needs the real, complete list separately.
  const [{ requests, stakeholders }, allStakeholders] = await Promise.all([
    fetchEngagementRequests(engagementId),
    fetchEngagementStakeholders(engagementId),
  ]);

  return (
    <main className="bg-[var(--bg)] p-7">
      <h1 className="mb-6 text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">Requests</h1>
      <RequestsToolbar
        engagementId={engagementId}
        stakeholders={allStakeholders}
        autoStart={onboarding && allStakeholders.length === 0}
      />
      <RequestsTable
        requests={requests}
        stakeholders={stakeholders}
        engagementId={engagementId}
        initialQuery={initialQuery}
      />
    </main>
  );
}
