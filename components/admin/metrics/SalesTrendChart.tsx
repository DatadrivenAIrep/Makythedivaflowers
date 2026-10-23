"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TrendPoint } from "@/lib/metrics/orders";
import type { Granularity } from "@/lib/metrics/period";
import { bucketLabel, money, showAxisLabel } from "./format";

type Props = { points: TrendPoint[]; granularity: Granularity; locale: string };
type Metric = "revenue" | "orders";

const W = 640, H = 220, L = 52, R = 16, T = 16, B = 28;
const PW = W - L - R, PH = H - T - B;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * mag >= v / 4) ?? 10;
  return Math.ceil(v / (step * mag)) * step * mag;
}

export default function SalesTrendChart({ points, granularity, locale }: Props) {
  const t = useTranslations("admin_metrics");
  const [metric, setMetric] = useState<Metric>("revenue");
  const [rawActive, setActive] = useState<number | null>(null);
  const title = t("trend_title_ly");
  const cur = points.map((p) => (metric === "revenue" ? p.revenueCents : p.orders));
  const prev = points.map((p) => (metric === "revenue" ? p.prevRevenueCents : p.prevOrders));
  const fmt = (v: number, compact = false) => (metric === "revenue" ? money(v, compact) : String(Math.round(v)));
  const peak = Math.max(0, ...cur, ...prev);
  // Orders: a multiple of 4 (at least 4) so the quarter ticks are distinct integers.
  const max = metric === "revenue" ? niceMax(peak) : Math.max(4, Math.ceil(peak / 4) * 4);
  const n = points.length;
  // The props can shrink under an open tooltip; never index past the end.
  const active = rawActive !== null && rawActive < n ? rawActive : null;
  const last = n - 1;
  const x = (i: number) => (n === 1 ? L + PW / 2 : L + (PW * i) / (n - 1));
  const y = (v: number) => T + PH * (1 - v / max);
  const line = (vs: number[]) => vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const empty = n === 0 || (cur.every((v) => v === 0) && prev.every((v) => v === 0));

  function pick(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    setActive(Math.min(last, Math.max(0, Math.round(((px - L) / PW) * (n - 1)))));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="text-xs uppercase tracking-wide text-ink/50">{title}</div>
        <div className="ml-auto flex gap-1" role="group">
          {(["revenue", "orders"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
              className={`rounded-full px-2.5 py-1 text-xs ${metric === m ? "bg-ink text-bone" : "border border-ink/15 hover:bg-ink/5"}`}
            >
              {t(m === "revenue" ? "metric_revenue" : "metric_orders")}
            </button>
          ))}
        </div>
      </div>
      {empty ? (
        <div className="flex h-40 items-center justify-center text-sm text-ink/50">{t("chart_empty")}</div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={title}
            tabIndex={0}
            className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-rouge/40"
            onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((a) => a ?? last)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setActive((a) => Math.min(last, Math.max(0, (a ?? last) - 1)));
              if (e.key === "ArrowRight") setActive((a) => Math.min(last, (a ?? last) + 1));
            }}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#EDE8E0" strokeWidth={1} />
                <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#6F685B">{fmt(v, true)}</text>
              </g>
            ))}
            <polygon points={`${x(0)},${y(0)} ${line(cur)} ${x(last)},${y(0)}`} fill="#B8345E" opacity={0.1} />
            <polyline points={line(prev)} fill="none" stroke="#BAB1A2" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={line(cur)} fill="none" stroke="#B8345E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              showAxisLabel(i, last, labelEvery) ? (
                <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#6F685B">
                  {bucketLabel(p.key, granularity, locale)}
                </text>
              ) : null,
            )}
            <circle cx={x(last)} cy={y(cur[last])} r={4.5} fill="#B8345E" stroke="#FAF6F0" strokeWidth={2} />
            <text x={x(last) - 6} y={y(cur[last]) - 9} textAnchor="end" fontSize={11} fontWeight={600} fill="#0E0D0C">
              {fmt(cur[last], true)}
            </text>
            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={T} y2={y(0)} stroke="#968D7E" strokeWidth={1} />
                <circle cx={x(active)} cy={y(prev[active])} r={4.5} fill="#BAB1A2" stroke="#FAF6F0" strokeWidth={2} />
                <circle cx={x(active)} cy={y(cur[active])} r={4.5} fill="#B8345E" stroke="#FAF6F0" strokeWidth={2} />
              </g>
            )}
          </svg>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-1 rounded-xl border border-mute-200 bg-white px-3 py-2 text-xs shadow-sm"
              style={{ left: `${Math.min(70, (x(active) / W) * 100)}%` }}
            >
              <div className="text-ink/60">{bucketLabel(points[active].key, granularity, locale)}</div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 bg-rouge" />
                <span className="font-semibold">{fmt(cur[active])}</span>
                <span className="text-ink/50">{t("trend_this_year")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3 bg-mute-300" />
                <span>{fmt(prev[active])}</span>
                <span className="text-ink/50">{t("trend_last_year")}</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="mt-1 flex gap-4 text-xs text-ink/70">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-rouge" />{t("trend_this_year")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 bg-mute-300" />{t("trend_last_year")}</span>
      </div>
      <table className="sr-only" aria-label={title}>
        <thead><tr><th>—</th><th>{t("trend_this_year")}</th><th>{t("trend_last_year")}</th></tr></thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.key}><td>{bucketLabel(p.key, granularity, locale)}</td><td>{fmt(cur[i])}</td><td>{fmt(prev[i])}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
