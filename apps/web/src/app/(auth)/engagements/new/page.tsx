import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NewEngagementForm } from "@/components/engagements/new-engagement-form";

// Static route, sibling to the [engagementId] dynamic segment -- Next.js
// resolves this before ever treating "new" as a dynamic engagementId value.
// No [engagementId]-scoped layout covers this route, so it does its own
// auth() check here rather than inheriting one, same "resource-based, not
// middleware path-matching" pattern as engagements/[engagementId]/layout.tsx.
export default async function NewEngagementPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const leadAuditorName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "Signed-in auditor";

  return <NewEngagementForm leadAuditorName={leadAuditorName} />;
}
