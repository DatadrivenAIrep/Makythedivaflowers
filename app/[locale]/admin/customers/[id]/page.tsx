import { notFound } from "next/navigation";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import CustomerProfile from "@/components/admin/customers/CustomerProfile";
import { getCustomerProfile } from "@/lib/customer-profile";

export const dynamic = "force-dynamic";

export default async function AdminCustomerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const profile = getCustomerProfile(id);
  if (!profile) notFound();
  return (
    <DashboardShell locale={locale}>
      <CustomerProfile locale={locale} initial={profile} />
    </DashboardShell>
  );
}
