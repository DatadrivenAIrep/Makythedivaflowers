import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import CustomersList from "@/components/admin/customers/CustomersList";
import { listAllTags, listCustomers } from "@/lib/customer-storage";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initial = listCustomers({});
  const allTags = listAllTags();
  return (
    <DashboardShell locale={locale}>
      <CustomersList locale={locale} initial={initial} allTags={allTags} />
    </DashboardShell>
  );
}
