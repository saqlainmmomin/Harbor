"use client";

import { usePathname } from "next/navigation";

// Re-keying a wrapper div on the pathname forces React to remount it on every
// navigation, which replays the CSS entry animation (globals.css's
// .animate-page-enter) on the new page's content -- opacity 0->1,
// translateY 6px->0, 220ms. Doesn't touch routing/data fetching at all: the
// Server Component tree under {children} still renders and streams exactly
// as it did before, this only wraps the result in an animated container.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-enter">
      {children}
    </div>
  );
}
