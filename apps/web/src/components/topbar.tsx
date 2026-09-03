"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { SearchField } from "@/components/search-field";

export function Topbar({
  engagementId,
  engagementName,
  engagementSubtitle,
}: {
  engagementId: string;
  engagementName: string | null;
  engagementSubtitle: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/engagements/${engagementId}/requests?q=${encodeURIComponent(q)}` : `/engagements/${engagementId}/requests`);
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)]/95 px-7 backdrop-blur">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold tracking-tight text-[var(--ink)]">{engagementName ?? "Untitled engagement"}</p>
        {engagementSubtitle && <p className="truncate text-xs text-[var(--ink-muted)]">{engagementSubtitle}</p>}
      </div>

      <form onSubmit={submitSearch} className="ml-auto min-w-0 flex-1 max-w-sm">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search requests, controls, people…"
          aria-label="Global search"
        />
      </form>

      {/* No notification bell here -- there was no notification system
          behind it, so it could only ever show "No notifications yet".
          Removed rather than left as permanent dead weight in the header. */}
      <div className="shrink-0">
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: "size-8",
            },
          }}
        />
      </div>
    </header>
  );
}
