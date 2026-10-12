// components/admin/metrics/OperationsTab.tsx
import { useTranslations } from "next-intl";
import type { MetricsPayload } from "@/lib/metrics-storage";
import { peakDay } from "@/lib/metrics/operations";
import HeatmapGrid from "./Heatmap";
import UpcomingLoad from "./UpcomingLoad";

const box = "rounded-2xl bg-bone p-3.5";
const head = "mb-2 text-xs uppercase tracking-wide text-ink/50";

export default function OperationsTab({ data, locale }: { data: MetricsPayload; locale: string }) {
  const t = useTranslations("admin_metrics");
  const peak = peakDay(data.operations.heatmap);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={`${box} lg:col-span-2`}>
        <div className={head}>{t("heatmap_title")}</div>
        <HeatmapGrid heatmap={data.operations.heatmap} />
        {peak && <p className="mt-2 text-xs text-ink/70">{t("heatmap_peak", { day: t(`weekday_full_${peak.weekday}`) })}</p>}
      </div>
      <div className={box}>
        <div className={head}>{t("upcoming_title")}</div>
        <UpcomingLoad days={data.operations.upcoming} locale={locale} />
      </div>
    </div>
  );
}
