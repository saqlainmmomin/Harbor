"use client";

// The Mirror-inspired centerpiece (spec sections 5-10): as the visitor
// scrolls vertically through this one section, the real Audit workflow --
// Scope, Checklist, RFI, Evidence, AI Review, Findings, Audit Ready -- moves
// past horizontally. Vertical scroll still drives everything; nothing here
// hijacks the scroll direction itself, it's a `position: sticky` panel whose
// internal content translates in response to how far the visitor has
// scrolled through the (tall) section wrapping it. Collapses to a plain
// vertical stack below `lg` (spec section 29 -- never trap mobile in
// horizontal scrolling).

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, AnimatePresence } from "motion/react";
import { Reveal, usePrefersReducedMotion } from "@/components/landing/motion-primitives";

type Stage = {
  key: string;
  step: string;
  label: string;
  title: string;
  body: string;
};

const STAGES: Stage[] = [
  { key: "scope", step: "01", label: "Scope", title: "Answer a few scope questions", body: "Pick ISO 27001, NIST CSF, or PCI-DSS and answer a short questionnaire; whatever doesn't apply is excluded, with a reason." },
  { key: "checklist", step: "02", label: "Checklist", title: "A control-mapped checklist, computed", body: "Every applicable control becomes a required or recommended checklist item, not a blank page." },
  { key: "rfi", step: "03", label: "RFI", title: "One RFI per control, drafted", body: "The checklist turns into a draft request-for-information list, assigned to stakeholders and sent in bulk." },
  { key: "evidence", step: "04", label: "Evidence", title: "Evidence arrives", body: "A stakeholder uploads a document against a specific control request." },
  { key: "ai-review", step: "05", label: "AI Review", title: "AI reads it first", body: "Extraction, classification, and a control-aware completeness check run before it reaches your queue." },
  { key: "findings", step: "06", label: "Findings", title: "Findings surface, mapped to controls", body: "Anything that doesn't hold up becomes a finding, tied back to the control and the evidence it came from." },
  { key: "ready", step: "07", label: "Audit ready", title: "Ready for review", body: "What reaches you is triaged: source, classification, and findings already mapped to controls." },
];

export function WorkflowStory() {
  // NOTE: `reduced` starts `false` on both server and the client's first
  // paint by construction (see usePrefersReducedMotion), so it must never
  // be used to swap which JSX tree gets rendered -- only earlier versions
  // of this component did that (branching on motion/react's own
  // useReducedMotion(), which resolves synchronously on the client and
  // caused a real hydration mismatch for visitors with the OS preference
  // set). Both variants below are always mounted; `reduced` only toggles
  // which one is visible (via className) and freezes the scroll-driven
  // transform, so the DOM shape itself never depends on it.
  const reduced = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // STAGES.length panels, last panel's "settled" position reached at 100%.
  // Frozen at "0%" for reduced-motion visitors -- the pinned variant is
  // hidden for them anyway, this just avoids driving a transform on a
  // hidden element for no reason.
  const trackX = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["0%", `-${(STAGES.length - 1) * 100}%`]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduced) return;
    const idx = Math.min(STAGES.length - 1, Math.max(0, Math.round(v * (STAGES.length - 1))));
    setActive((prev) => (prev === idx ? prev : idx));
  });

  return (
    <div id="how-it-works">
      {/* Vertical stack -- the only version reduced-motion visitors ever
          see (at any screen size), and the mobile/tablet version for
          everyone else. No pinning, no horizontal transform, just ordinary
          scroll reveals. */}
      <section className={`mx-auto max-w-xl px-6 py-20 sm:px-10 ${reduced ? "" : "lg:hidden"}`}>
        <SectionHeading />
        <div className="mt-12 flex flex-col gap-4">
          {STAGES.map((s, i) => (
            <Reveal key={s.key} delay={i * 0.04}>
              <StagePanel stage={s} index={i} active />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Desktop: pinned, scroll-driven horizontal sequence. Hidden
          entirely for reduced-motion visitors, not just visually skipped --
          `hidden` removes it from layout so the vertical stack above is
          what actually occupies the page for them. */}
      <section
        ref={sectionRef}
        className={`relative ${reduced ? "hidden" : "hidden lg:block"}`}
        style={{ height: `${STAGES.length * 62}vh` }}
      >
        <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden px-10">
          <div className="mx-auto w-full max-w-5xl">
            <SectionHeading />
          </div>

          <div className="relative mt-10 h-[420px] w-full overflow-hidden">
            <motion.div className="flex h-full" style={{ x: trackX }}>
              {STAGES.map((s, i) => (
                <div key={s.key} className="flex h-full w-full shrink-0 items-center justify-center">
                  <StagePanel stage={s} index={i} active={active === i} />
                </div>
              ))}
            </motion.div>
          </div>

          {/* Progress rail -- the one piece of chrome that stays fixed while
              the panels move past it, so progression is always legible. */}
          <div className="mx-auto mt-8 flex w-full max-w-2xl items-center gap-2">
            {STAGES.map((s, i) => (
              <div key={s.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-black/[0.08]">
                  <motion.div
                    className="h-full rounded-full bg-[#14171C]"
                    initial={false}
                    animate={{ scaleX: active >= i ? 1 : 0 }}
                    style={{ originX: 0 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
                <span
                  className={`text-[10.5px] font-semibold tracking-wide uppercase transition-colors duration-200 ${
                    active === i ? "text-[#14171C]" : "text-[#ADA795]"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading() {
  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold tracking-wider text-[#8A8578] uppercase">The workflow</p>
      <h2 className="mx-auto mt-3 max-w-2xl text-[32px] leading-tight font-bold tracking-tight text-[#14171C] text-balance sm:text-[40px]">
        From scope to audit-ready, in one path.
      </h2>
    </div>
  );
}

function StagePanel({ stage, index, active }: { stage: Stage; index: number; active: boolean }) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-black/[0.06] bg-white p-8 shadow-[0_20px_50px_-24px_rgba(20,23,28,0.25)] sm:p-10">
      <p className="text-[11px] font-semibold tracking-wider text-[#8A8578] uppercase">
        {stage.step} <span className="text-[#DDD7CB]">&middot;</span> {stage.label}
      </p>
      <h3 className="mt-3 text-2xl font-bold tracking-tight text-[#14171C]">{stage.title}</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[#5B5647]">{stage.body}</p>
      <div className="mt-6 border-t border-black/[0.06] pt-6">
        <StageDetail index={index} active={active} />
      </div>
    </div>
  );
}

// The one bit of per-stage "living" content: a small, concrete illustration
// of that step in the real workflow -- built from the same vocabulary
// (status dots, badges, checkmarks) as the product itself, not a generic
// icon. All labels are workflow states, not real customer data or metrics.
function StageDetail({ index, active }: { index: number; active: boolean }) {
  switch (index) {
    case 0:
      return (
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
          <FlowChip label="ISO 27001" tone="neutral" />
          <FlowChip label="NIST CSF" tone="violet" active={active} delay={0.1} />
          <FlowChip label="PCI-DSS" tone="neutral" active={active} delay={0.2} />
        </div>
      );
    case 1:
      return (
        <ul className="space-y-2">
          {[
            { label: "Access control policy", required: true },
            { label: "Vendor risk assessments", required: false },
          ].map((item, i) => (
            <motion.li
              key={item.label}
              initial={{ opacity: 0, x: -8 }}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.35, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center justify-between gap-2.5 rounded-lg bg-[#F2EFEA] px-3 py-2 text-[13px] font-medium text-[#14171C]"
            >
              <span className="flex items-center gap-2.5">
                <DocIcon /> {item.label}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase ${
                  item.required ? "bg-[#FBEECD] text-[#8A5A0B]" : "bg-white text-[#8A8578]"
                }`}
              >
                {item.required ? "Required" : "Recommended"}
              </span>
            </motion.li>
          ))}
        </ul>
      );
    case 2:
      return (
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <FlowChip label="Checklist" tone="neutral" />
          <Arrow active={active} />
          <FlowChip label="RFI draft" tone="violet" active={active} delay={0.15} />
          <Arrow active={active} delay={0.3} />
          <FlowChip label="Sent" tone="emerald" active={active} delay={0.45} />
        </div>
      );
    case 3:
      return (
        <ul className="space-y-2">
          {["AWS IAM user export", "Access control policy"].map((label, i) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, x: -8 }}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.35, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center gap-2.5 rounded-lg bg-[#F2EFEA] px-3 py-2 text-[13px] font-medium text-[#14171C]"
            >
              <DocIcon /> {label}
            </motion.li>
          ))}
        </ul>
      );
    case 4:
      return (
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <FlowChip label="Evidence" tone="neutral" />
          <Arrow active={active} />
          <FlowChip label="Analysis" tone="violet" active={active} delay={0.15} />
          <Arrow active={active} delay={0.3} />
          <FlowChip label="Extracted" tone="emerald" active={active} delay={0.45} />
        </div>
      );
    case 5:
      return (
        <AnimatePresence mode="wait">
          <motion.p
            key={active ? "flagged" : "reviewing"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FBEECD] px-3 py-2 text-[13px] font-semibold text-[#8A5A0B]"
          >
            <WarnIcon /> {active ? "Potential exception detected" : "3 controls reviewed"}
          </motion.p>
        </AnimatePresence>
      );
    default:
      return (
        <motion.p
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E3EEE8] px-3 py-2 text-[13px] font-semibold text-[#2E4C3B]"
        >
          <CheckIcon /> Evidence triaged, findings mapped to controls
        </motion.p>
      );
  }
}

function FlowChip({
  label,
  tone,
  active = true,
  delay = 0,
}: {
  label: string;
  tone: "neutral" | "violet" | "emerald" | "rose";
  active?: boolean;
  delay?: number;
}) {
  const toneClass = {
    neutral: "bg-[#F2EFEA] text-[#5B5647]",
    violet: "bg-[#EDE9FB] text-[#6D4FC2]",
    emerald: "bg-[#E3EEE8] text-[#2E4C3B]",
    rose: "bg-[#FBE7E9] text-[#9F1D2C]",
  }[tone];
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={active ? { opacity: 1, scale: 1 } : { opacity: 0.4, scale: 0.96 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      className={`rounded-full px-3 py-1.5 whitespace-nowrap ${toneClass}`}
    >
      {label}
    </motion.span>
  );
}

function Arrow({ active, delay = 0 }: { active: boolean; delay?: number }) {
  return (
    <motion.svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="#ADA795"
      strokeWidth={1.6}
      className="size-3.5 shrink-0"
      aria-hidden
      initial={{ opacity: 0, x: -3 }}
      animate={active ? { opacity: 1, x: 0 } : { opacity: 0.3, x: -3 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
    >
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </motion.svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="#8A8578" strokeWidth={1.5} className="size-3.5 shrink-0" aria-hidden>
      <path d="M4 2h5l3 3v9H4z" strokeLinejoin="round" />
      <path d="M9 2v3h3" strokeLinejoin="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5 shrink-0" aria-hidden>
      <path d="M8 2l7 12H1L8 2z" strokeLinejoin="round" />
      <path d="M8 6.5v3.2M8 11.7v.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5 shrink-0" aria-hidden>
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
