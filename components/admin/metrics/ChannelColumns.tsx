"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { CHANNELS, type ChannelBucket, type ChannelShare } from "@/lib/metrics/sales";
import type { Granularity } from "@/lib/metrics/period";
import { CHANNEL_COLOR, bucketLabel, money } from "./format";

type Props = { buckets: ChannelBucket[]; shares: ChannelShare[]; granularity: Granularity; locale: string };

const W = 640, H = 200, L = 52, R = 12, T = 12, B = 26;
const PW = W - L - R, PH = H - T - B, GAP = 2;

export default function ChannelColumns({ buckets, shares, granularity, locale }: Props) {
  const t = useTranslations("admin_metrics");
  const [active, setActive] = useState<number | null>(null);
  const totals = buckets.map((b) => CHANNELS.reduce((s, c) => s + b[c], 0));
  const max = Math.max(1, ...totals);
  const band = PW / Math.max(1, buckets.length);
  const bw = Math.min(24, band * 0.6);
  const h = (v: number) => (PH * v) / max;
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-ink/50">{t("channels_title")}</div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t("channels_title")} className="block">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={L} x2={W - R} y1={T + PH * (1 - f)} y2={T + PH * (1 - f)} stroke="#EDE8E0" />
              <text x={L - 6} y={T + PH * (1 - f) + 3} textAnchor="end" fontSize={10} fill="#6F685B">{money(max * f, true)}</text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const cx = L + band * (i + 0.5);
            const segs = CHANNELS.filter((c) => b[c] > 0);
            let top = T + PH;
            return (
              <g
                key={b.key}
                tabIndex={0}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <rect x={cx - band / 2} y={T} width={band} height={PH} fill="transparent" />
                {segs.map((c, k) => {
                  const segH = h(b[c]);
                  const isTop = k === segs.length - 1;
                  top -= segH;
                  return (
                    <rect
                      key={c}
                      x={cx - bw / 2}
                      y={top}
                      width={bw}
                      height={Math.max(0.5, segH - (isTop ? 0 : GAP))}
                      rx={isTop ? 4 : 0}
                      fill={CHANNEL_COLOR[c]}
                      opacity={active === null || active === i ? 1 : 0.55}
                    />
                  );
                })}
                {(i % labelEvery === 0 || i === buckets.length - 1) && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill="#6F685B">{bucketLabel(b.key, granularity, locale)}</text>
                )}
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <div role="status" className="pointer-events-none absolute right-2 top-1 rounded-xl border border-mute-200 bg-white px-3 py-2 text-xs shadow-sm">
            <div className="text-ink/60">{bucketLabel(buckets[active].key, granularity, locale)} · {money(totals[active])}</div>
            {CHANNELS.filter((c) => buckets[active][c] > 0).map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3" style={{ background: CHANNEL_COLOR[c] }} />
                <span className="font-semibold">{money(buckets[active][c])}</span>
                <span className="text-ink/50">{t(`channel_${c}`)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
        {shares.map((s) => (
          <li key={s.channel} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CHANNEL_COLOR[s.channel] }} />
            <span>{t(`channel_${s.channel}`)} {s.sharePct}%</span>
            {s.shareDeltaPts !== null && s.shareDeltaPts !== 0 && (
              <span className={s.shareDeltaPts > 0 ? "text-success" : "text-error"}>
                {t("share_pts", { sign: s.shareDeltaPts > 0 ? "+" : "−", pts: Math.abs(s.shareDeltaPts) })}
              </span>
            )}
          </li>
        ))}
      </ul>
      <table className="sr-only" aria-label={t("channels_title")}>
        <tbody>
          {shares.map((s) => (
            <tr key={s.channel}><td>{t(`channel_${s.channel}`)}</td><td>{money(s.cents)}</td><td>{s.sharePct}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
