import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Audit Copilot",
  description: "Request, track, and review SOC 2 audit evidence.",
};

// No ClerkProvider here deliberately — this layout also wraps /upload/[token]
// (stakeholder magic-link flow) and the root redirect, neither of which
// should carry any Clerk involvement at all. ClerkProvider is scoped to the
// (auth) route group instead — see src/app/(auth)/layout.tsx.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
