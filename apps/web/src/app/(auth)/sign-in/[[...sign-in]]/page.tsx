import { SignIn } from "@clerk/nextjs";

// Catch-all route ([[...sign-in]]) so Clerk's own internal steps (email
// verification, SSO callback, etc.) all resolve under /sign-in/*.
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignIn />
    </div>
  );
}
