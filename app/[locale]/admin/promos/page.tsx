import { listPromos } from "@/lib/promo";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import PromosView from "@/components/admin/promos/PromosView";

export default async function AdminPromosPage({
  params,
}: {
  params: Promise<{ locale: "en" | "es" }>;
}) {
  const { locale } = await params;
  return (
    <DashboardShell locale={locale}>
      <PromosView initialPromos={listPromos()} locale={locale} />
    </DashboardShell>
  );
}
