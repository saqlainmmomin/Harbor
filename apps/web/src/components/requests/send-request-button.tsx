"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendEvidenceRequest } from "@/lib/api";

/** Row-level action for a request still at "not_sent". Email is the
 * stakeholder's own address, not a free-text field — the whole point of
 * attaching a stakeholder to a request up front is that there's nothing
 * left to ask for here. */
export function SendRequestButton({ requestId, email }: { requestId: string; email: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.MouseEvent) {
    e.stopPropagation();
    setState("sending");
    setError(null);
    const result = await sendEvidenceRequest(requestId, email);
    if (result.ok) {
      router.refresh();
      return;
    }
    setState("error");
    setError(result.message);
  }

  if (state === "error") {
    return (
      <button
        onClick={handleSend}
        title={error ?? undefined}
        className="rounded-md border border-[var(--status-rose-ring)] bg-[var(--status-rose-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--status-rose-ink)]"
      >
        Retry send
      </button>
    );
  }

  return (
    <button
      onClick={handleSend}
      disabled={state === "sending"}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {state === "sending" ? "Sending…" : "Send"}
    </button>
  );
}
