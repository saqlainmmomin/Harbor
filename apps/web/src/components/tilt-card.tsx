"use client";

import { useRef } from "react";

// A real pointer-tracked 3D tilt, not a canned CSS keyframe -- the card
// rotates toward wherever the cursor actually is and eases back on leave.
// Respects prefers-reduced-motion by doing nothing at all in that case.
export function TiltCard({
  children,
  className = "",
  maxTilt = 8,
  lift = true,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  lift?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * maxTilt * 2;
    const rotateX = (0.5 - py) * maxTilt * 2;
    ref.current.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) ${
      lift ? "translateZ(6px)" : ""
    }`;
  }

  function onMouseLeave() {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0px)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`transition-transform duration-300 ease-out [transform-style:preserve-3d] ${className}`}
    >
      {children}
    </div>
  );
}
