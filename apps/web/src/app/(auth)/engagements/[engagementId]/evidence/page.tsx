import { notFound } from "next/navigation";
import { EvidenceFilesTable } from "@/components/evidence/evidence-files-table";
import { fetchEngagement, fetchEngagementEvidenceFiles } from "@/lib/api";

export default async function EvidencePage(props: PageProps<"/engagements/[engagementId]/evidence">) {
  const { engagementId } = await props.params;

  const engagement = await fetchEngagement(engagementId);
  if (!engagement) notFound();

  const files = await fetchEngagementEvidenceFiles(engagementId);

  return (
    <main className="bg-[var(--bg)] p-7">
      <h1 className="mb-6 text-[28px] leading-tight font-bold tracking-tight text-[var(--ink)]">Evidence</h1>
      <EvidenceFilesTable files={files} engagementId={engagementId} />
    </main>
  );
}
