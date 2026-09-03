// This app has no multi-tenant org model, so it's not a functioning
// switcher -- no dropdown of fabricated organizations -- just the one real
// client engagement. Previously wrapped in TiltCard (pointer-tracked 3D
// tilt + rotate + scale + a 32px-blur shadow on hover) -- restrained to a
// plain, calm hover here instead; that flourish read as decorative rather
// than as part of a sober enterprise surface. TiltCard itself is untouched
// and still used on the public landing page.
export function EngagementSwitcher({ engagementName }: { engagementName: string | null }) {
  const initial = (engagementName ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="group mb-2 flex items-center gap-2.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface)]">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--border-strong)] text-[10px] font-bold text-[var(--ink-secondary)]">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--ink)]">
          {engagementName ?? "No engagement"}
        </p>
        <p className="text-[10px] text-[var(--ink-faint)]">Current engagement</p>
      </div>
    </div>
  );
}
