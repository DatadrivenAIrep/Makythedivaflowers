// app/[locale]/admin/accounts/page.tsx
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import AccountsView from "@/components/admin/accounts/AccountsView";
import { listAccounts } from "@/lib/house-account-storage";
import { upcomingSends } from "@/lib/house-account-sends";
import { shopDateStr } from "@/lib/tv-slots";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({ params }: { params: Promise<{ locale: "en" | "es" }> }) {
  const { locale } = await params;
  const today = shopDateStr(new Date());
  return (
    <DashboardShell locale={locale}>
      <AccountsView locale={locale} initialAccounts={listAccounts({ today })} initialUpcoming={upcomingSends(7, today)} />
    </DashboardShell>
  );
}
