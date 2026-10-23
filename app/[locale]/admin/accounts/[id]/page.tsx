import { notFound } from "next/navigation";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import AccountDetail from "@/components/admin/accounts/AccountDetail";
import { getAccountDetail } from "@/lib/house-account-detail";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage({ params }: { params: Promise<{ locale: "en" | "es"; id: string }> }) {
  const { locale, id } = await params;
  const detail = getAccountDetail(id);
  if (!detail) notFound();
  return (
    <DashboardShell locale={locale}>
      <AccountDetail locale={locale} initial={detail} />
    </DashboardShell>
  );
}
