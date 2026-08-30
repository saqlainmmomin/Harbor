import { notFound } from "next/navigation";
import { EvidenceDashboard } from "@/components/dashboard/evidence-dashboard";
import { formatPeriod } from "@/lib/format";
import { fetchEngagement, fetchEngagementRequests } from "@/lib/api";

export default async function EvidenceDashboardPage(
  props: PageProps<"/engagements/[engagementId]">,
) {
  const { engagementId } = await props.params;

  const engagement = await fetchEngagement(engagementId);
  if (!engagement) notFound();

  const { requests, stakeholders } = await fetchEngagementRequests(engagementId);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">{engagement.client_name}</h1>
              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                SOC 2
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {engagement.name} · Period {formatPeriod(engagement.period_start, engagement.period_end)} ·
              Lead {engagement.lead_auditor}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Send reminders
            </button>
            <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              New request
            </button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <EvidenceDashboard
          requests={requests}
          stakeholders={stakeholders}
          engagementId={engagementId}
        />
      </main>
    </>
  );
}
