import Link from "next/link";
import { engagement } from "@/lib/mock-data";

const NAV = [
  { label: "Evidence dashboard", href: `/engagements/${engagement.id}`, ready: true },
  { label: "Control checklist", href: "#", ready: false },
  { label: "Stakeholders", href: "#", ready: false },
  { label: "Activity log", href: "#", ready: false },
  { label: "Report pack", href: "#", ready: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <span className="flex size-6 items-center justify-center rounded bg-slate-900 text-[11px] font-bold text-white">
            AC
          </span>
          <span className="text-sm font-semibold tracking-tight">Audit Copilot</span>
        </div>

        <nav className="flex-1 p-3">
          <p className="px-2 pb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            Engagement
          </p>
          <ul className="space-y-0.5">
            {NAV.map((item) =>
              item.ready ? (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="block rounded-md bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-900"
                  >
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li
                  key={item.label}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-slate-400"
                  title="Not built in this prototype"
                >
                  {item.label}
                  <span className="rounded bg-slate-100 px-1 text-[10px] font-medium text-slate-400">
                    soon
                  </span>
                </li>
              ),
            )}
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2 px-1">
            <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
              AR
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">A. Rao</p>
              <p className="truncate text-xs text-slate-500">Lead auditor</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
