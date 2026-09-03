// The centerpiece: a large, art-directed visualization of the real product
// (real nav taxonomy, real workflow, real palette from the authenticated
// app) rather than an actual screenshot. Diagonal dark/light split, floating
// cards, a translucent header bar -- composition borrowed from the supplied
// reference; every label is Audit Copilot's own domain, not the reference's.
// Deliberately light on numbers/small print -- a first-time viewer should
// read the shape of the workflow, not squint at stats.

"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { TiltCard } from "@/components/tilt-card";

const SIDEBAR_ITEMS = ["Overview", "Evidence", "Requests", "Controls", "Findings"];

const WORKFLOW = [
  { n: "01", title: "Evidence Request", status: "Submitted" },
  { n: "02", title: "AI Extraction", status: "Extracted" },
  { n: "03", title: "Control Mapping", status: "Matched" },
  { n: "04", title: "Review", status: "Needs attention" },
];

const NOTIFICATIONS = [
  { title: "Evidence uploaded", detail: "AWS IAM export received", tone: "neutral" as const },
  { title: "AI analysis complete", detail: "Extraction finished", tone: "violet" as const },
  { title: "Potential exception", detail: "Missing MFA on one account", tone: "amber" as const },
];

export function ProductPreview() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <TiltCard maxTilt={3} className="relative mx-auto w-full max-w-6xl">
      {/* Translucent floating header bar -- layered above the split, not part of it */}
      <div className="relative z-30 mx-auto -mb-7 flex w-[92%] max-w-2xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-white/90 px-7 py-4 shadow-[0_20px_50px_-15px_rgba(20,23,28,0.25)] backdrop-blur-md sm:gap-8">
        <HeaderStat label="Organization" value="Acme Corporation" />
        <HeaderStat label="Engagement" value="SOC 2 Type II" />
        <HeaderStat label="Readiness" value="On track" accent />
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-black/[0.06] shadow-[0_40px_90px_-30px_rgba(20,23,28,0.35)]">
        {/* Dark half */}
        <div className="absolute inset-0 bg-[#0B0E13]" />
        {/* Light half -- diagonal clip, subtle dot texture, no gradient wash */}
        <div
          className="absolute inset-0 bg-[#F2EFEA]"
          style={{
            clipPath: "polygon(40% 0, 100% 0, 100% 100%, 58% 100%)",
            backgroundImage: "radial-gradient(rgba(20,23,28,0.06) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        {/* Seam highlight -- a single thin line, not a gradient blend */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(40% 0, 40.3% 0, 58.3% 100%, 58% 100%)",
            background: "rgba(255,255,255,0.18)",
          }}
        />

        <div className="relative pt-16 pb-24">
          {/* Left: mini application sidebar */}
          <div className="absolute top-16 left-8 hidden w-44 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm sm:block">
            <div className="mb-3 flex items-center gap-1.5 px-1">
              <span className="flex size-4 items-center justify-center rounded-[4px] bg-[#3A5F4A] text-[8px] font-bold text-white">
                AC
              </span>
              <span className="text-[11px] font-semibold text-white/90">Audit Copilot</span>
            </div>
            <ul className="space-y-0.5">
              {SIDEBAR_ITEMS.map((item, i) => (
                <li
                  key={item}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                    i === 1 ? "bg-white/10 text-white" : "text-white/45"
                  }`}
                >
                  {item}
                </li>
              ))}
            </ul>
            <div className="my-2 border-t border-white/10" />
            <p className="px-2 text-[11px] font-medium text-white/45">Activity</p>
            <p className="px-2 py-1 text-[11px] font-medium text-white/45">Settings</p>
          </div>

          {/* Left: stacked notification cards -- positioned well clear of the
              sidebar above it (6 nav items + divider + 2 more lines runs to
              roughly 290px), not calculated from a guess. */}
          <div className="absolute top-[330px] left-8 hidden w-52 flex-col gap-2 sm:flex">
            {NOTIFICATIONS.map((n) => (
              <div
                key={n.title}
                className="rounded-lg border border-white/10 bg-[#12161D]/90 px-3 py-2.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 rounded-full ${
                      n.tone === "amber" ? "bg-amber-400" : n.tone === "violet" ? "bg-violet-400" : "bg-white/40"
                    }`}
                  />
                  <p className="text-[11px] font-semibold text-white/90">{n.title}</p>
                </div>
                <p className="mt-0.5 pl-3 text-[10.5px] text-white/50">{n.detail}</p>
              </div>
            ))}
          </div>

          {/* Floating toggle pill, overlapping the seam */}
          <div className="absolute top-16 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-2.5 rounded-full border border-black/[0.06] bg-white px-4 py-2 shadow-[0_16px_40px_-12px_rgba(20,23,28,0.35)] sm:flex">
            <span className="text-[11px] font-medium text-[#14171C]">AI auto-review</span>
            <span className="flex h-5 w-9 items-center rounded-full bg-[#3A5F4A] p-0.5">
              <span className="size-4 translate-x-4 rounded-full bg-white transition-transform" />
            </span>
          </div>

          {/* Floating alert card -- lives in the empty band between the
              toggle pill and the (now-lower) workflow row, clear of card 04 */}
          <div className="absolute top-6 right-8 z-20 hidden w-52 rounded-xl border border-black/[0.06] bg-white p-3 shadow-[0_20px_50px_-15px_rgba(20,23,28,0.3)] md:block">
            <p className="text-[10px] font-semibold tracking-wider text-[#8A8578] uppercase">AI Review</p>
            <p className="mt-1 text-[13px] font-semibold text-[#14171C]">Potential issue detected</p>
            <button className="mt-2 rounded-lg bg-[#14171C] px-3 py-1 text-[11px] font-semibold text-white">
              Review findings
            </button>
          </div>

          {/* Center: connected workflow cards -- hovering one highlights it
              and the connector reaching into it, a small, honest gesture at
              "this is a real interface" (spec section 18) without implying
              buttons that don't do anything. */}
          <div className="relative z-10 mx-auto mt-24 hidden w-full max-w-4xl items-stretch justify-center gap-3 px-8 lg:flex">
            {WORKFLOW.map((step, i) => (
              <div key={step.n} className="flex flex-1 items-center">
                <div
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                  className={`w-full rounded-xl border bg-white p-4 shadow-[0_16px_36px_-14px_rgba(20,23,28,0.3)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_-18px_rgba(20,23,28,0.4)] ${
                    hovered === i ? "border-[#3A5F4A]/40" : "border-black/[0.06]"
                  }`}
                >
                  <p className="text-[10px] font-bold tracking-wider text-[#8A8578]">{step.n}</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#14171C]">{step.title}</p>
                  <p className="mt-2 text-[10.5px] font-medium text-[#3A5F4A]">{step.status}</p>
                </div>
                {i < WORKFLOW.length - 1 && (
                  <span
                    className={`mx-1.5 h-px w-4 shrink-0 transition-colors duration-200 ${
                      hovered === i || hovered === i + 1 ? "bg-[#3A5F4A]/50" : "bg-[#14171C]/15"
                    }`}
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>

          {/* Right: light evidence-review surface */}
          <div className="relative z-10 mx-auto mt-10 w-[88%] max-w-md rounded-xl border border-black/[0.06] bg-white p-5 shadow-[0_20px_50px_-16px_rgba(20,23,28,0.25)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_28px_56px_-20px_rgba(20,23,28,0.35)] sm:ml-auto sm:mr-10 sm:mt-16">
            <p className="text-[11px] font-semibold tracking-wide text-[#8A8578] uppercase">Evidence Review</p>
            <p className="mt-1 text-sm font-bold text-[#14171C]">AWS IAM User Export</p>
            <ul className="mt-3 space-y-1.5 text-[12.5px]">
              <li className="flex items-center gap-2 text-[#3A5F4A]">
                <CheckMark /> User identities detected
              </li>
              <li className="flex items-center gap-2 text-[#3A5F4A]">
                <CheckMark /> Privileged accounts detected
              </li>
              <li className="flex items-center gap-2 text-amber-600">
                <WarnMark /> MFA configuration requires review
              </li>
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-black/[0.06] pt-3">
              <div>
                <p className="text-[10px] font-medium tracking-wide text-[#8A8578] uppercase">AI confidence</p>
                <p className="text-sm font-bold text-[#3A5F4A]">High</p>
              </div>
              <button className="rounded-lg bg-[#14171C] px-3.5 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#2A2E36]">
                Review evidence
              </button>
            </div>
          </div>
        </div>

        {/* Bottom playback bar */}
        <div className="absolute right-8 bottom-6 left-8 z-20 flex items-center gap-4">
          <button
            aria-label="AI evidence review progress"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_16px_36px_-10px_rgba(0,0,0,0.5)]"
          >
            <PlayIcon />
          </button>
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[11px] font-medium text-white/70">AI evidence review in progress</p>
            <div className="h-[3px] rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full bg-white"
                initial={{ width: "0%" }}
                whileInView={{ width: "72%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
              />
            </div>
          </div>
        </div>
      </div>
    </TiltCard>
  );
}

function HeaderStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wider text-[#8A8578] uppercase">{label}</p>
      <p className={`text-sm font-bold ${accent ? "text-[#3A5F4A]" : "text-[#14171C]"}`}>{value}</p>
    </div>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5 shrink-0" aria-hidden>
      <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WarnMark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5 shrink-0" aria-hidden>
      <path d="M8 2l7 12H1L8 2z" strokeLinejoin="round" />
      <path d="M8 6.5v3.2M8 11.7v.3" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="#14171C" className="ml-0.5 size-4" aria-hidden>
      <path d="M7 5v14l12-7z" />
    </svg>
  );
}
