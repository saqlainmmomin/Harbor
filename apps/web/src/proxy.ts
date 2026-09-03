import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` (see
// node_modules/next/dist/docs/.../file-conventions/proxy.md) — same
// (request) => Response|void handler shape, new file name.
//
// This just needs to run ahead of any Server Component that calls auth() —
// the actual "redirect to sign-in if unauthenticated" check lives as a
// resource-based check in src/app/(auth)/engagements/[engagementId]/layout.tsx.
// Deliberately not using createRouteMatcher + auth.protect() here: as of
// @clerk/nextjs 7.8, Clerk itself deprecated that pattern — middleware path
// matching can diverge from how Next.js actually routes a request and leave
// protected resources reachable; checking auth() at the resource (layout)
// is the current recommendation.
export default clerkMiddleware();

export const config = {
  // Only initialize Clerk on routes that need it. "/" is a fully public
  // landing page now (no auth check at all -- see src/app/page.tsx) and
  // /upload/[token] is the stakeholder magic-link flow -- both get
  // genuinely zero Clerk involvement, not just "unauthenticated but let
  // through". Removing "/" from this matcher is also a small win against
  // the documented Clerk dev-instance handshake quirk: the root route can
  // no longer contribute an extra hop to that redirect chain.
  matcher: ["/engagements(.*)", "/sign-in(.*)", "/sign-up(.*)"],
};
