import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/logo";

// Catch-all route ([[...sign-in]]) so Clerk's own internal steps (email
// verification, SSO callback, etc.) all resolve under /sign-in/*.
export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50">
      <Link href="/">
        <Logo className="text-[28px] leading-none" />
      </Link>
      <SignIn />
    </div>
  );
}
