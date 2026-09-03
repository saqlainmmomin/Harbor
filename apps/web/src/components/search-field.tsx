// Shared visual shell for every search input in the app (topbar, requests
// table, evidence table) -- was three near-identical hand-rolled inputs
// with no icon and slightly different radii/heights. Purely presentational;
// callers keep their own value/onChange/submit logic.
export function SearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label"?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--ink-faint)]"
      >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M11.5 11.5 14.5 14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="h-10 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] pr-3.5 pl-9 text-sm text-[var(--ink)] outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-[var(--ink-faint)] placeholder:transition-opacity placeholder:duration-150 focus:border-[var(--border-strong)] focus:bg-[var(--surface)] focus:shadow-[0_0_0_3px_rgba(20,23,28,0.06)] focus:placeholder:opacity-60"
      />
    </div>
  );
}
