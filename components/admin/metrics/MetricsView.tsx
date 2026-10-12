"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { METRICS_RANGES, type MetricsRange } from "@/lib/metrics/period";
import type { MetricsPayload } from "@/lib/metrics-storage";
import KpiCard from "./KpiCard";
import SalesTrendChart from "./SalesTrendChart";
import InsightList, { type TabId } from "./InsightList";
import SalesTab from "./SalesTab";
import OperationsTab from "./OperationsTab";
import CustomersTab from "./CustomersTab";
import { money } from "./format";

type Props = { locale: string; initial: MetricsPayload };

const TABS: { id: TabId; key: string }[] = [
  { id: "sales", key: "tab_sales" },
  { id: "operations", key: "tab_operations" },
  { id: "customers", key: "tab_customers" },
];

export default function MetricsView({ locale, initial }: Props) {
  const t = useTranslations("admin_metrics");
  const [data, setData] = useState<MetricsPayload>(initial);
  const [range, setRange] = useState<MetricsRange>(initial.range);
  const [tab, setTab] = useState<TabId>("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function pick(r: MetricsRange) {
    setRange(r);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/metrics?range=${r}&locale=${locale}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as MetricsPayload);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function openTab(id: TabId) {
    setTab(id);
    document.getElementById("metrics-tabs")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const k = data.kpis;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl text-ink">{t("title")}</h1>
        <div className="ml-auto flex flex-wrap gap-1" role="group">
          {METRICS_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => void pick(r)}
              className={`min-h-10 rounded-full px-3.5 text-sm ${range === r ? "bg-rouge text-bone" : "border border-ink/15 bg-white hover:bg-ink/5"}`}
            >
              {t(`range_${r}`)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("empty")}</div>}

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label={t("kpi_revenue")} value={money(k.revenue.value)} delta={k.revenue.delta} />
          <KpiCard label={t("kpi_orders")} value={String(k.orders.value)} delta={k.orders.delta} />
          <KpiCard label={t("kpi_aov")} value={money(k.aov.value)} delta={k.aov.delta} />
          <KpiCard label={t("kpi_new_customers")} value={String(k.newCustomers.value)} delta={k.newCustomers.delta} />
          <KpiCard
            label={t("kpi_pending")}
            value={money(k.pendingCents + k.houseAccountsCents)}
            sub={t("kpi_pending_sub", { n: k.pendingCount, amount: money(k.houseAccountsCents) })}
            href={`/${locale}/admin/accounts`}
          />
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-2xl bg-bone p-3.5">
            <SalesTrendChart points={data.trend} granularity={data.period.granularity} locale={locale} />
          </div>
          <div className="rounded-2xl bg-bone p-3.5">
            <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("insights_title")}</div>
            <InsightList insights={data.insights} onTab={openTab} />
          </div>
        </div>

        <div id="metrics-tabs" role="tablist" aria-label={t("title")} className="mb-3 flex gap-5 border-b border-mute-200">
          {TABS.map((x) => (
            <button
              key={x.id}
              id={`tab-${x.id}`}
              role="tab"
              type="button"
              aria-selected={tab === x.id}
              aria-controls={`panel-${x.id}`}
              onClick={() => setTab(x.id)}
              className={`-mb-px border-b-2 py-2 text-sm ${tab === x.id ? "border-rouge font-semibold text-ink" : "border-transparent text-ink/60 hover:text-ink"}`}
            >
              {t(x.key)}
            </button>
          ))}
        </div>
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === "sales" && <SalesTab data={data} locale={locale} />}
          {tab === "operations" && <OperationsTab data={data} locale={locale} />}
          {tab === "customers" && <CustomersTab data={data} locale={locale} />}
        </div>
      </div>
    </div>
  );
}
