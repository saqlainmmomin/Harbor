"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";

// The logo itself never moves or unmounts in a way that would cause layout
// shift -- same text, same position, every navigation. Re-keying just this
// inner span on pathname replays globals.css's .animate-logo-pulse (scale
// 0.98->1, tiny opacity lift, 250ms) so it reads as alive without ever
// relocating, rotating, or bouncing.
export function LogoMotion({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <span key={pathname} className="animate-logo-pulse inline-block">
      <Logo className={className} />
    </span>
  );
}
