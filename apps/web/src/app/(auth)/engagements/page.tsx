import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchEngagements } from "@/lib/api";

// The post-sign-in landing target (see .env.local's
// NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL). No UI of its own --
// every visit here immediately redirects onward. This exists because a
// static Clerk redirect URL can't do "go to my engagement if I have one,
// otherwise go create one" -- that needs a real check, so it needs a real
// route. Falls under the /engagements(.*) proxy matcher already, so it's
// covered by clerkMiddleware without any extra config.
export default async function EngagementsIndexPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const engagements = await fetchEngagements();
  if (engagements.length > 0) redirect(`/engagements/${engagements[0].id}`);
  redirect("/engagements/new");
}
