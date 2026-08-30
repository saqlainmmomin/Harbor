import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { DEFAULT_ENGAGEMENT_ID } from "@/lib/config";

// The prototype has a single seeded engagement. The real app lands on an
// engagement list for the signed-in auditor.
//
// Redirects straight to /sign-in when signed out, instead of always bouncing
// through /engagements/[id] first. That extra hop used to stack on top of
// Clerk's own dev-instance handshake retries (see src/proxy.ts) and could
// push the total redirect count for a cold, cookie-less visit past the
// browser's redirect-loop limit -- an actual ERR_TOO_MANY_REDIRECTS, not a
// hypothetical one (reproduced with Playwright against this exact route).
export default async function Home() {
  const { userId } = await auth();
  redirect(userId ? `/engagements/${DEFAULT_ENGAGEMENT_ID}` : "/sign-in");
}
