import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { ActivityEvent } from "@/lib/api";

// Real activity_log rows -- every upload and AI-analysis-complete event is
// written here by the API (see main.py's log_activity()). This is the full
// engagement-wide trail; the same rows are also shown scoped to a single
// request on its review panel.
export function ActivityTimeline({ activity, engagementId }: { activity: ActivityEvent[]; engagementId: string }) {
  if (activity.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
        Nothing logged yet. Once a stakeholder uploads evidence or the AI review runs, it will appear here.
      </p>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <ol className="flex flex-col gap-4">
        {activity.map((a) => (
          <li key={a.id} className="flex items-start gap-3.5">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${actorDot(a.actor_type)}`} aria-hidden />
            <div className="min-w-0 flex-1 border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
              <p className="text-sm text-[var(--ink)]">
                <span className="font-medium">{a.actor}</span>: {a.action}
                {a.request_title && a.request_id && (
                  <>
                    {" "}
                    on{" "}
                    <Link
                      href={`/engagements/${engagementId}/requests/${a.request_id}`}
                      className="font-medium hover:text-[var(--accent)] hover:underline"
                    >
                      {a.request_title}
                    </Link>
                  </>
                )}
              </p>
              {a.detail && <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{a.detail}</p>}
              <p className="mt-0.5 text-xs text-[var(--ink-faint)]">{formatDateTime(a.created_at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function actorDot(actorType: string): string {
  switch (actorType) {
    case "ai":
      return "bg-[var(--status-violet-dot)]";
    case "stakeholder":
      return "bg-[var(--status-amber-dot)]";
    case "auditor":
      return "bg-[var(--accent)]";
    default:
      return "bg-[var(--ink-faint)]";
  }
}
