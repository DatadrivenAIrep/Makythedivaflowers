import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import PipelineBoard from "@/components/admin/pipeline/PipelineBoard";
import { listInquiries } from "@/lib/inquiry-storage-db";
import { stageCounts, openPipelineValueCents } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function AdminPipelinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const inquiries = listInquiries();
  const initial = {
    inquiries,
    stats: { counts: stageCounts(inquiries), openValueCents: openPipelineValueCents(inquiries) },
  };
  return (
    <DashboardShell locale={locale}>
      <PipelineBoard locale={locale} initial={initial} />
    </DashboardShell>
  );
}
