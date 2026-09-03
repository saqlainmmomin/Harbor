import dynamic from "next/dynamic";
import { HeroSection } from "@/components/landing/hero-section";
import { IntelligenceSection, AuditTrailSection, FinalCta } from "@/components/landing/marketing-sections";

// Code-split, not eagerly bundled with the hero -- WorkflowStory pulls in
// motion's scroll-tracking hooks (useScroll/useTransform/useMotionValueEvent)
// on top of what the hero already needs, and it's the entire second
// viewport's worth of content, below the fold on first paint. Splitting it
// into its own chunk means the browser doesn't have to parse/hydrate it
// before the hero becomes interactive; it loads in parallel and is ready by
// the time a visitor actually scrolls to it. `loading` reserves roughly its
// real height so nothing visibly jumps once the real chunk swaps in.
const WorkflowStory = dynamic(
  () => import("@/components/landing/workflow-story").then((m) => m.WorkflowStory),
  { loading: () => <div className="h-[60vh]" aria-hidden /> },
);

// Fully public landing page -- no auth() call, not in the Clerk proxy
// matcher (see src/proxy.ts), same treatment as /upload/[token]. A light,
// premium marketing canvas -- deliberately not dark like the authenticated
// app; the dark/light split lives inside the product visualization only.
export default function Home() {
  return (
    <div className="bg-[#FAF8F5]">
      <HeroSection />
      <WorkflowStory />
      <IntelligenceSection />
      <AuditTrailSection />
      <FinalCta />
    </div>
  );
}
