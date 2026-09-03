import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { Logo } from "@/components/logo";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-slate-50">
      <Link href="/">
        <Logo className="text-[28px] leading-none" />
      </Link>
      <SignUp />
    </div>
  );
}
