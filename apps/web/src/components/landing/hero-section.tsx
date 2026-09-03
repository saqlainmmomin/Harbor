"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ProductPreview } from "@/components/landing/product-preview";
import { CursorGlow } from "@/components/landing/cursor-glow";
import { LogoMotion } from "@/components/logo-motion";
import { EASE_OUT, fadeUp, staggerParent, usePrefersReducedMotion } from "@/components/landing/motion-primitives";

export function HeroSection() {
  const reduced = usePrefersReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Very subtle parallax on the product preview as the hero scrolls out of
  // view (spec section 17, 5-20px) -- everything else in the hero (nav,
  // headline, CTAs) stays put; only this one decorative element drifts.
  const { scrollYProgress } = useScroll({ target: rootRef, offset: ["start start", "end start"] });
  const previewY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 18]);

  // Nav surface: transparent over the hero, a subtle blurred surface once
  // the visitor has actually scrolled past it (spec section 12). A plain
  // scroll listener, not a scroll-linked animation -- this is a one-time
  // state flip, not something that should track scroll position smoothly.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={rootRef} className="group relative bg-[#FAF8F5]">
      <header
        className={`sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300 ${
          scrolled ? "border-b border-black/[0.06] bg-[#FAF8F5]/85 backdrop-blur-md" : "border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="flex items-center gap-3">
            <LogoMotion className="text-2xl leading-none" />
            <p className="hidden text-[11px] text-[#8A8578] sm:block">AI-powered evidence intelligence</p>
          </Link>
          <div className="flex items-center gap-1">
            <IconButton label="Help">
              <HelpIcon />
            </IconButton>
            <Link
              href="/sign-in"
              className="ml-2 rounded-lg bg-[#14171C] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2A2E36] hover:shadow-[0_10px_20px_-8px_rgba(20,23,28,0.4)]"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </header>

      <div className="relative isolate">
        <CursorGlow />
        <motion.main
          className="mx-auto max-w-6xl px-6 pt-10 pb-4 text-center sm:px-10 sm:pt-16"
          initial="hidden"
          animate="show"
          variants={staggerParent(0.09, 0.05, reduced)}
        >
          <motion.p variants={fadeUp(reduced)} className="text-[11px] font-semibold tracking-wider text-[#8A8578] uppercase">
            Audit intelligence &middot; compliance evidence review
          </motion.p>
          <motion.h1
            variants={fadeUp(reduced)}
            className="mx-auto mt-5 max-w-2xl text-5xl leading-[1.08] font-extrabold tracking-tight text-[#14171C] text-balance sm:text-6xl lg:text-[68px]"
          >
            Evidence review before you open the file.
          </motion.h1>
          <motion.p variants={fadeUp(reduced)} className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-[#5B5647]">
            AI extracts, classifies, and maps audit evidence to controls before it reaches your review
            queue, so you spend your time on exceptions, not documents.
          </motion.p>
          <motion.div variants={fadeUp(reduced)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg bg-[#14171C] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2A2E36] hover:shadow-[0_14px_28px_-10px_rgba(20,23,28,0.5)]"
            >
              Start an audit
            </Link>
            <a
              href="#how-it-works"
              className="group/link inline-flex items-center gap-1.5 rounded-lg border border-black/[0.1] px-6 py-3 text-sm font-medium text-[#14171C] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/[0.03]"
            >
              See how it works
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5"
                aria-hidden
              >
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </motion.div>
        </motion.main>
      </div>

      <motion.div
        className="px-6 pt-14 pb-0 sm:px-10"
        initial={{ opacity: 0, y: reduced ? 0 : 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0.01 : 0.6, ease: EASE_OUT, delay: reduced ? 0 : 0.32 }}
      >
        {/* Separate element for the scroll-linked parallax -- keeps the
            one-time entrance animation above (plain numbers) from fighting
            with this continuous scroll-driven MotionValue on the same
            transform property. */}
        <motion.div style={{ y: previewY }}>
          <ProductPreview />
        </motion.div>
      </motion.div>
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg text-[#5B5647] transition-colors hover:bg-black/[0.04]"
    >
      {children}
    </button>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-[18px]" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 114 2c-.6.5-1.5 1-1.5 2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
