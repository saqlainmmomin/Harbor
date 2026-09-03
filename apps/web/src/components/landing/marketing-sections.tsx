"use client";

import Link from "next/link";
import { TiltCard } from "@/components/tilt-card";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/landing/motion-primitives";

// Trimmed to one word per idea, deliberately -- this used to be three
// full sentences of marketing copy. The product itself is the explanation;
// this is just a label. Each card tilts toward the cursor on hover.
//
// Asymmetric layout (spec section 26: not a grid of identical cards) -- the
// first idea ("Extracted") is the foundation the other two depend on, so it
// reads as the primary card; "Classified" and "Validated" stack beside it
// as supporting detail.
export function IntelligenceSection() {
  const primary = { title: "Extracted", body: "No manual transcription. Text, tables, and structure come straight off the document." };
  const supporting = [
    { title: "Classified", body: "Typed against your evidence catalog." },
    { title: "Validated", body: "Checked beneath the model's judgment." },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 sm:px-10">
      <Reveal>
        <h2 className="text-center text-[32px] leading-tight font-bold tracking-tight text-[#14171C] text-balance sm:text-[36px]">
          Every conclusion traces back to a source.
        </h2>
      </Reveal>
      <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-5" stagger={0.1}>
        <StaggerItem className="sm:col-span-3">
          <TiltCard maxTilt={4} className="h-full">
            <div className="flex h-full flex-col justify-center rounded-2xl border border-black/[0.06] bg-white p-8 shadow-[0_4px_16px_-8px_rgba(20,23,28,0.12)] transition-shadow duration-300 hover:shadow-[0_20px_40px_-16px_rgba(20,23,28,0.25)]">
              <h3 className="text-lg font-bold text-[#14171C]">{primary.title}</h3>
              <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-[#5B5647]">{primary.body}</p>
            </div>
          </TiltCard>
        </StaggerItem>
        <div className="flex flex-col gap-5 sm:col-span-2">
          {supporting.map((it) => (
            <StaggerItem key={it.title}>
              <TiltCard maxTilt={6}>
                <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_4px_16px_-8px_rgba(20,23,28,0.12)] transition-shadow duration-300 hover:shadow-[0_20px_40px_-16px_rgba(20,23,28,0.25)]">
                  <h3 className="text-base font-bold text-[#14171C]">{it.title}</h3>
                  <p className="mt-1.5 text-sm text-[#5B5647]">{it.body}</p>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </div>
      </StaggerGroup>
    </section>
  );
}

export function AuditTrailSection() {
  const events = [
    { actor: "Sarah", action: "uploaded AWS IAM export", time: "2 minutes ago" },
    { actor: "AI review", action: "completed analysis", time: "5 minutes ago" },
    { actor: "AI review", action: "flagged a potential exception", time: "8 minutes ago" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 sm:px-10">
      <div className="grid gap-10 sm:grid-cols-[280px_1fr]">
        <Reveal>
          <p className="text-[11px] font-semibold tracking-wider text-[#8A8578] uppercase">Audit trail</p>
          <h2 className="mt-3 text-[28px] leading-tight font-bold tracking-tight text-[#14171C]">
            Every action, provable.
          </h2>
        </Reveal>
        <StaggerGroup as="ol" className="space-y-1" stagger={0.08}>
          {events.map((e, i) => (
            <StaggerItem
              key={i}
              as="li"
              className="flex items-start gap-3 rounded-lg px-3 py-3 transition-colors duration-150 hover:bg-[#F2EFEA]"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#3A5F4A]" aria-hidden />
              <div>
                <p className="text-sm text-[#14171C]">
                  <span className="font-semibold">{e.actor}</span> {e.action}
                </p>
                <p className="mt-0.5 text-xs text-[#8A8578]">{e.time}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 text-center sm:px-10">
      <Reveal>
        <h2 className="text-[32px] leading-tight font-bold tracking-tight text-[#14171C] text-balance">
          Start your next SOC 2 engagement with evidence already triaged.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-lg bg-[#14171C] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2A2E36] hover:shadow-[0_14px_28px_-10px_rgba(20,23,28,0.5)]"
          >
            Start an audit
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg border border-black/[0.1] px-6 py-3 text-sm font-medium text-[#14171C] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/[0.03]"
          >
            Create an account
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
