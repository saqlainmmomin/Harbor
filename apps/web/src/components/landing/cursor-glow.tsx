"use client";

import { useEffect, useRef } from "react";

// A very subtle radial highlight that tracks the pointer within the hero.
// Deliberately cheap: one absolutely-positioned div, moved via CSS custom
// properties + a rAF-throttled mousemove handler (transform/background only
// -- no layout properties touched, nothing re-renders on every pixel of
// movement since this never calls setState). Off entirely on touch devices
// and prefers-reduced-motion, per spec section 3.
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    if (reduced || touch) return;

    const parent = el.parentElement;
    if (!parent) return;

    function onMove(e: MouseEvent) {
      const rect = parent!.getBoundingClientRect();
      target.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (raf.current == null) raf.current = requestAnimationFrame(tick);
    }

    // Eases toward the pointer rather than snapping to it -- this is what
    // keeps the "maximum movement ~4-10px" feel even though the glow itself
    // travels further; the visible drift per frame is small and settles.
    function tick() {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      current.current = { x: current.current.x + dx * 0.12, y: current.current.y + dy * 0.12 };
      if (el) {
        el.style.setProperty("--glow-x", `${current.current.x}px`);
        el.style.setProperty("--glow-y", `${current.current.y}px`);
      }
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = null;
      }
    }

    function onLeave() {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    }

    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseleave", onLeave);
    return () => {
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseleave", onLeave);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 [.group:hover_&]:opacity-100"
      style={{
        background:
          "radial-gradient(480px circle at var(--glow-x, 50%) var(--glow-y, 0%), rgba(20,23,28,0.05), transparent 70%)",
      }}
    />
  );
}
