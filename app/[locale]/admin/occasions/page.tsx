import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import OccasionsView from "@/components/admin/occasions/OccasionsView";
import DateResults from "@/components/admin/occasions/DateResults";
import { dateResults } from "@/lib/date-results";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";

export const dynamic = "force-dynamic";

export default async function AdminOccasionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initial = listUpcomingOccasions(30);
  const results = dateRewardsEnabled() ? dateResults() : null;
  return (
    <DashboardShell locale={locale}>
      {results && <DateResults results={results} />}
      <OccasionsView locale={locale} initial={initial} />
    </DashboardShell>
  );
}
