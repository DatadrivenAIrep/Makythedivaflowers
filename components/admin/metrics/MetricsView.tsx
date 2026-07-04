"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MetricsRange } from "@/lib/metrics";
import type { MetricsPayload } from "@/lib/metrics-storage";
import KpiCard from "./KpiCard";
import Sparkline from "./Sparkline";
import RankTable, { type RankRow } from "./RankTable";

type Props = { locale: string; initial: MetricsPayload };

function money(c: number) {
  return `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const RANGES: Array<{ id: MetricsRange; key: string }> = [
  { id: "30d", key: "range_30d" },
  { id: "90d", key: "range_90d" },
  { id: "ytd", key: "range_ytd" },
  { id: "all", key: "range_all" },
];

export default function MetricsView({ locale, initial }: Props) {
  const t = useTranslations("admin_metrics");
  const [data, setData] = useState<MetricsPayload>(initial);
  const [range, setRange] = useState<MetricsRange>(initial.range);
  const [error, setError] = useState(false);

  async function pick(r: MetricsRange) {
    setRange(r);
    try {
      const res = await fetch(`/api/admin/metrics?range=${r}&locale=${locale}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as MetricsPayload);
      setError(false);
    } catch {
      setError(true);
    }
  }

  const k = data.kpis;
  const kpis = [
    { key: "kpi_revenue", value: money(k.revenueCents), sub: `${t("kpi_outstanding")}: ${money(k.outstandingCents)}` },
    { key: "kpi_orders", value: String(k.orderCount) },
    { key: "kpi_aov", value: money(k.aovCents) },
    { key: "kpi_repeat_rate", value: `${k.repeatRatePct}%`, sub: t("kpi_repeat_rate_note") },
  ];

  const productRows: RankRow[] = data.topProducts.map((p) => ({
    key: p.key,
    name: p.key === "__custom__" ? t("custom_products") : p.name,
    value: String(p.qty),
    sub: p.cents === null ? t("not_available") : money(p.cents),
  }));

  const zoneRows: RankRow[] = data.byZone.map((z) => ({
    key: z.zoneId,
    name: z.label,
    value: money(z.cents),
    sub: `${z.orderCount} ${t("col_orders").toLowerCase()}`,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <div className="ml-auto flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => void pick(r.id)}
              className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
                range === r.id ? "bg-rouge text-bone" : "border border-ink/20 hover:bg-ink/5"
              }`}
            >
              {t(r.key)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-3 rounded bg-rose-50 p-3 text-sm text-rose-800">{t("empty")}</div>}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((c) => (
          <KpiCard key={c.key} label={t(c.key)} value={c.value} sub={c.sub} />
        ))}
      </div>

      <div className="mb-3 rounded border border-ink/10 bg-bone p-3">
        <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("trend_title")}</div>
        <Sparkline points={data.monthly.map((m) => m.cents)} ariaLabel={t("trend_title")} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("top_products_title")}</div>
          <RankTable
            nameHeader={t("col_product")}
            valueHeader={t("col_qty")}
            rows={productRows}
            emptyLabel={t("empty")}
          />
        </div>
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-ink/50">{t("by_zone_title")}</div>
          <RankTable
            nameHeader={t("col_zone")}
            valueHeader={t("col_revenue")}
            rows={zoneRows}
            emptyLabel={t("empty")}
          />
        </div>
      </div>
    </div>
  );
}
