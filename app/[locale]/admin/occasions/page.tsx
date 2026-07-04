import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import OccasionsView from "@/components/admin/occasions/OccasionsView";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";

export const dynamic = "force-dynamic";

export default async function AdminOccasionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initial = listUpcomingOccasions(30);
  return (
    <DashboardShell locale={locale}>
      <OccasionsView locale={locale} initial={initial} />
    </DashboardShell>
  );
}
