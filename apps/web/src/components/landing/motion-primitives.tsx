"use client";

// Shared motion vocabulary for the landing page -- every section below reuses
// these instead of inventing its own timing/easing, so the whole page reads
// as one motion language (spec: "one motion language", section 32). Built on
// `motion/react` (the maintained successor to framer-motion) rather than
// hand-rolled IntersectionObserver code -- the number of viewport reveals,
// stagger groups, and scroll-linked transforms on this page makes the real
// library meaningfully safer and shorter than reimplementing it.

import { useEffect, useLayoutEffect, useState } from "react";
import { motion, type Variants } from "motion/react";

// Framer-style ease-out -- matches --ease-out in globals.css (already used
// by the rest of the app's motion system) so this doesn't introduce a
// second, subtly different curve.
export const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// motion/react's own `useReducedMotion()` reads `window.matchMedia`
// synchronously on the client's very first render -- before React's
// hydration diff runs -- while the server (no `window`) always renders as
// if motion were allowed. For a visitor who actually has the OS preference
// set, that's a real mismatch: SSR bakes in `initial={{opacity:0,y:20}}`
// (motion writes it as an inline style), the client's first render skips it,
// React logs a hydration error and discards the whole tree. This hook
// starts at `false` (matching what SSR always assumes) on both server and
// the client's first paint, then corrects itself in a layout effect -- which
// runs after hydration is committed, so it's a normal state update, not a
// hydration diff. The one-time cost is a brief instant where a
// reduced-motion visitor's very first paint still assumes motion is fine;
// there is no hydration-safe way to know their OS preference any earlier.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// `fadeUp`/`staggerParent` take the reduced-motion flag and shrink the
// distance/duration to (functionally) nothing rather than removing the
// animation -- deliberately never producing an `undefined` `initial`/
// `animate`/`whileInView` prop anywhere in this file. Toggling those props
// between a variant and `undefined` while an animation is actually in
// flight abandons it wherever it happened to be (this is exactly what an
// earlier version of this file did for the hero: `reduced` flips from
// false to true a few milliseconds after mount, right as the entrance
// fade-in is starting, and swapping `animate` to `undefined` mid-flight
// froze the whole hero at ~0 opacity, permanently invisible, for anyone
// with the OS preference on). Keeping the props' shape constant and only
// changing the numbers inside them means motion always still animates
// *toward a defined, visible target* -- it just does it instantly and
// without moving, for reduced-motion visitors.
export function fadeUp(reduced = false): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    show: { opacity: 1, y: 0, transition: { duration: reduced ? 0.01 : 0.5, ease: EASE_OUT } },
  };
}

export function staggerParent(stagger = 0.09, delayChildren = 0, reduced = false): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : stagger, delayChildren: reduced ? 0 : delayChildren } },
  };
}

// Viewport reveal wrapper -- opacity 0->1, translateY 20px->0, 400-600ms
// (spec section 16). `once` so it doesn't re-trigger on scroll-back, which
// would read as "attention grabbing" rather than storytelling.
export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 20,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: reduced ? 0.01 : 0.55, ease: EASE_OUT, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

// Stagger container -- reveals a group of children (cards, list items) with
// a small delay between each, only once, only when scrolled into view.
// `as` lets it render as a semantically correct wrapper (e.g. "ol") when its
// children are StaggerItems rendered as "li", instead of always emitting a
// div wherever it's dropped in.
export function StaggerGroup({
  children,
  className = "",
  stagger = 0.09,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  as?: "div" | "ol" | "ul";
}) {
  const reduced = usePrefersReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={staggerParent(stagger, 0, reduced)}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const reduced = usePrefersReducedMotion();
  const Component = motion[as];
  return (
    <Component className={className} variants={fadeUp(reduced)}>
      {children}
    </Component>
  );
}
