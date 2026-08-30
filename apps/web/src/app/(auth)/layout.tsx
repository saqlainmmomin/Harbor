import { ClerkProvider } from "@clerk/nextjs";

// Route group (parentheses = no URL segment) scoping ClerkProvider to
// everything that actually needs Clerk: /engagements/* and Clerk's own
// /sign-in, /sign-up. /upload/[token] and the root redirect sit outside this
// group, at the true app root, and never load Clerk at all.
export default function AuthGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
