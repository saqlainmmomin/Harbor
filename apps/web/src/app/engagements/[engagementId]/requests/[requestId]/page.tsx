import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlChip, StatusBadge } from "@/components/badges";
import { ReviewPanel } from "@/components/review/review-panel";
import { dueLabel } from "@/lib/format";
import {
  controlByRef,
  evidenceRequests,
  getActivityFor,
  getRequest,
  stakeholderById,
} from "@/lib/mock-data";

export function generateStaticParams() {
  return evidenceRequests.map((r) => ({
    engagementId: r.engagement_id,
    requestId: r.id,
  }));
}

export default async function ReviewPage(
  props: PageProps<"/engagements/[engagementId]/requests/[requestId]">,
) {
  const { engagementId, requestId } = await props.params;
  const request = getRequest(requestId);
  if (!request) notFound();

  const stakeholder = stakeholderById[request.stakeholder_id];
  const control = controlByRef[request.control_ref];
  const due = dueLabel(request.due_date);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="px-6 py-3">
          <Link
            href={`/engagements/${engagementId}`}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            ← Evidence dashboard
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ControlChip refCode={request.control_ref} />
                <h1 className="text-lg font-semibold tracking-tight">{request.title}</h1>
                <StatusBadge status={request.status} />
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {control?.title} · Assigned to {stakeholder.full_name} ({stakeholder.role_title}) ·{" "}
                <span className={due.tone === "overdue" ? "font-medium text-rose-600" : ""}>
                  {due.text}
                </span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main>
        <p className="border-b border-slate-200 bg-slate-100 px-6 py-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Request sent to stakeholder:</span>{" "}
          {request.description}
        </p>
        <ReviewPanel
          request={request}
          stakeholder={stakeholder}
          activity={getActivityFor(request.id)}
        />
      </main>
    </>
  );
}
