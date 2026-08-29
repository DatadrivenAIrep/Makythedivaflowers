import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import CampaignsPage from "@/components/admin/campaigns/CampaignsPage";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <DashboardShell locale={locale}>
      <CampaignsPage locale={locale} />
    </DashboardShell>
  );
}
