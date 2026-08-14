import { AppShell } from "@/components/app-shell";

export default function EngagementLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
