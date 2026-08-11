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
  // Wedding/event only — contact-type inquiries live in the same table but must
  // stay out of the sales kanban (mirrors the /api/admin/inquiries filter).
  const inquiries = listInquiries({ types: ["wedding", "event"] });
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
