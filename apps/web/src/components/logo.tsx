// Was <Image src="/logo.png">, a 98x25px raster asset stretched up to
// 28-48px tall across five different usage sites -- soft/pixelated at 1x,
// worse on retina. No SVG source exists to swap in instead, so per the
// "recreate as clean text" fallback: the wordmark rendered as real text in
// the app's own font (Inter), which is crisp at any size/DPR by
// construction and needs no separate asset at all.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-[-0.02em] text-[var(--ink)] ${className}`}>
      Aud<span className="tracking-[-0.01em]">IT</span>
    </span>
  );
}
