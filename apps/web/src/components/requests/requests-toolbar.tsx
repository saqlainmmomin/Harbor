"use client";

import { useState } from "react";
import { AddStakeholderForm } from "@/components/requests/add-stakeholder-form";
import { NewRequestForm } from "@/components/requests/new-request-form";
import type { Stakeholder } from "@/lib/types";

type Panel = "none" | "stakeholder" | "request";

export function RequestsToolbar({
  engagementId,
  stakeholders,
  autoStart = false,
}: {
  engagementId: string;
  stakeholders: Stakeholder[];
  /** True right after creating a brand-new engagement with nothing in it
   * yet (see requests/page.tsx's ?onboarding=1) -- opens the "Add
   * stakeholder" panel immediately instead of landing on an empty page
   * with no visible next step. */
  autoStart?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(autoStart ? "stakeholder" : "none");
  // Tracks whether we're still inside the guided onboarding sequence --
  // starts true iff autoStart did; cleared the moment the visitor cancels
  // out of either step, so it never re-triggers on a later, unrelated
  // "+ Add stakeholder" click.
  const [chaining, setChaining] = useState(autoStart);
  const close = () => setPanel("none");
  function afterStakeholder(succeeded?: boolean) {
    if (chaining && succeeded) {
      setPanel("request");
    } else {
      setChaining(false);
      close();
    }
  }
  function afterRequest() {
    setChaining(false);
    close();
  }

  return (
    <div className="mb-5 flex flex-col gap-3">
      {chaining && (panel === "stakeholder" || panel === "request") && (
        <p className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm text-[var(--ink-secondary)]">
          <span className="font-semibold text-[var(--ink)]">Engagement created.</span>{" "}
          {panel === "stakeholder"
            ? "Add who you'll be requesting evidence from, then create your first request. That's where you'll actually upload or send for evidence."
            : "Stakeholder added. Now create the request. Once it exists, you can upload evidence to it directly or send it for upload."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setChaining(false);
            setPanel(panel === "stakeholder" ? "none" : "stakeholder");
          }}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-raised)]"
        >
          + Add stakeholder
        </button>
        <button
          onClick={() => {
            setChaining(false);
            setPanel(panel === "request" ? "none" : "request");
          }}
          disabled={stakeholders.length === 0}
          title={stakeholders.length === 0 ? "Add a stakeholder first" : undefined}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)] transition-[background-color,transform,box-shadow] duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-hover)] disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-50"
        >
          + New request
        </button>
        {stakeholders.length === 0 && (
          <span className="self-center text-xs text-[var(--ink-faint)]">
            Add a stakeholder before creating a request. Every request needs an owner.
          </span>
        )}
      </div>

      {panel === "stakeholder" && <AddStakeholderForm engagementId={engagementId} onDone={afterStakeholder} />}
      {panel === "request" && (
        // Keyed on the stakeholder set so that in the chained onboarding
        // flow -- this can mount before AddStakeholderForm's router.refresh()
        // has delivered the newly-added stakeholder as a prop -- it remounts
        // and re-picks a real default selection once that arrives, instead
        // of being stuck on the empty list it initially mounted with.
        <NewRequestForm
          key={stakeholders.map((s) => s.id).join(",")}
          engagementId={engagementId}
          stakeholders={stakeholders}
          onDone={afterRequest}
        />
      )}
    </div>
  );
}
