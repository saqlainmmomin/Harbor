import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

// Every route under /engagements requires a signed-in auditor. This runs for
// this layout and everything nested under it (the dashboard and the review
// panel) — a resource-based check, not middleware path matching (see
// src/proxy.ts for why).
export default async function EngagementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return <AppShell>{children}</AppShell>;
}
