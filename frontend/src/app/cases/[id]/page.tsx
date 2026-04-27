import { CaseDetailPage } from "@/components/case-detail-page";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseDetailPage caseId={id} />;
}
