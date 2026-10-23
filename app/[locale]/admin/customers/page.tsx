import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import CustomersList from "@/components/admin/customers/CustomersList";
import { listAllTags, listCustomers } from "@/lib/customer-storage";
import { previewBackfill } from "@/lib/backfill-customers";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initial = listCustomers({});
  const allTags = listAllTags();
  const backfill = previewBackfill();
  return (
    <DashboardShell locale={locale}>
      <CustomersList locale={locale} initial={initial} allTags={allTags} backfill={backfill} />
    </DashboardShell>
  );
}
