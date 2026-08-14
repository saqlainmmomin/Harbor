import { redirect } from "next/navigation";
import { engagement } from "@/lib/mock-data";

// The prototype has a single seeded engagement. The real app lands on an
// engagement list for the signed-in auditor.
export default function Home() {
  redirect(`/engagements/${engagement.id}`);
}
