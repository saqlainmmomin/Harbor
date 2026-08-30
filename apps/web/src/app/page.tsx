import { redirect } from "next/navigation";
import { DEFAULT_ENGAGEMENT_ID } from "@/lib/config";

// The prototype has a single seeded engagement. The real app lands on an
// engagement list for the signed-in auditor.
export default function Home() {
  redirect(`/engagements/${DEFAULT_ENGAGEMENT_ID}`);
}
