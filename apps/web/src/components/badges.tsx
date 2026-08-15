import type { CompletenessLabel, ConfidenceLabel, FlagSeverity, RequestStatus } from "@/lib/types";
import { COMPLETENESS_LABEL, STATUS_LABEL } from "@/lib/format";

const STATUS_STYLE: Record<RequestStatus, string> = {
  not_sent: "bg-slate-100 text-slate-600 ring-slate-200",
  awaiting_upload: "bg-slate-100 text-slate-700 ring-slate-200",
  ai_processing: "bg-violet-50 text-violet-700 ring-violet-200",
  pending_review: "bg-amber-50 text-amber-800 ring-amber-300",
  changes_requested: "bg-orange-50 text-orange-800 ring-orange-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${STATUS_STYLE[status]}`}
    >
      {status === "ai_processing" && (
        <span className="size-1.5 animate-pulse rounded-full bg-violet-500" aria-hidden />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

const COMPLETENESS_STYLE: Record<CompletenessLabel, string> = {
  complete: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  partial: "bg-amber-50 text-amber-800 ring-amber-200",
  insufficient: "bg-rose-50 text-rose-800 ring-rose-200",
};

const COMPLETENESS_BAR: Record<CompletenessLabel, string> = {
  complete: "w-full bg-emerald-500",
  partial: "w-1/2 bg-amber-500",
  insufficient: "w-1/6 bg-rose-500",
};

export function CompletenessBadge({
  value,
  withBar = false,
}: {
  value: CompletenessLabel;
  withBar?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {withBar && (
        <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <span className={`block h-full rounded-full ${COMPLETENESS_BAR[value]}`} />
        </span>
      )}
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${COMPLETENESS_STYLE[value]}`}
      >
        {COMPLETENESS_LABEL[value]}
      </span>
    </span>
  );
}

const SEVERITY_STYLE: Record<FlagSeverity, { chip: string; dot: string; label: string }> = {
  blocker: { chip: "border-rose-200 bg-rose-50/60", dot: "bg-rose-500", label: "Blocker" },
  warning: { chip: "border-amber-200 bg-amber-50/60", dot: "bg-amber-500", label: "Warning" },
  info: { chip: "border-slate-200 bg-slate-50", dot: "bg-slate-400", label: "Info" },
};

export function severityStyle(severity: FlagSeverity) {
  return SEVERITY_STYLE[severity];
}

const CONFIDENCE_STYLE: Record<ConfidenceLabel, { chip: string; label: string }> = {
  strong_match: { chip: "bg-emerald-50 text-emerald-800 ring-emerald-200", label: "Strong match" },
  partial_match: { chip: "bg-amber-50 text-amber-800 ring-amber-200", label: "Partial match" },
  weak_match: { chip: "bg-slate-100 text-slate-600 ring-slate-300", label: "Weak match" },
};

export function confidenceStyle(confidence: ConfidenceLabel) {
  return CONFIDENCE_STYLE[confidence];
}

export function ControlChip({ refCode }: { refCode: string }) {
  return (
    <span className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700">
      {refCode}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600"
      aria-hidden
    >
      {initials}
    </span>
  );
}
