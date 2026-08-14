import type { AuditorContact } from "@/lib/upload-link";

export function LinkProblem({
  variant,
  auditor,
}: {
  variant: "expired" | "invalid";
  auditor?: AuditorContact;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            className="size-6 text-amber-600"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          {variant === "expired" ? "This link has expired" : "This link isn't valid"}
        </h1>

        {variant === "expired" && auditor ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Upload links only stay active for a limited time. To get a new one, contact{" "}
              <span className="font-medium text-slate-900">{auditor.name}</span> at {auditor.firm}.
            </p>
            <a
              href={`mailto:${auditor.email}`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Email {auditor.name.split(" ")[0]}
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Please check the link in your email and try again, or contact the person who sent it to
            you.
          </p>
        )}
      </div>
    </div>
  );
}
