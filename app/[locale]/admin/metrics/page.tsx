import { getTranslations } from "next-intl/server";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import MetricsView from "@/components/admin/metrics/MetricsView";
import { getMetrics } from "@/lib/metrics-storage";

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage({
  params,
}: {
  params: Promise<{ locale: "en" | "es" }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin_metrics" });
  const labels = { customProducts: t("custom_products"), unknownZone: t("unknown_zone") };
  const initial = getMetrics("90d", new Date(), locale, labels);
  return (
    <DashboardShell locale={locale}>
      <MetricsView locale={locale} initial={initial} />
    </DashboardShell>
  );
}
