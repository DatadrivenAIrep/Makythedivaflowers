// components/admin/metrics/SalesTab.tsx
import { useTranslations } from "next-intl";
import type { MetricsPayload } from "@/lib/metrics-storage";
import ChannelColumns from "./ChannelColumns";
import { money } from "./format";

const box = "rounded-2xl bg-bone p-3.5";
const head = "mb-2 text-xs uppercase tracking-wide text-ink/50";

export default function SalesTab({ data, locale }: { data: MetricsPayload; locale: string }) {
  const t = useTranslations("admin_metrics");
  const s = data.sales;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={`${box} lg:col-span-2`}>
        <ChannelColumns buckets={s.channelTrend} shares={s.channels} granularity={data.period.granularity} locale={locale} />
      </div>
      <div className={box}>
        <div className={head}>{t("promos_title")}</div>
        <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
          <dt className="text-ink/70">{t("promo_discounts")}</dt><dd className="text-right font-semibold">{money(s.promos.discountCents)}</dd>
          <dt className="text-ink/70">{t("promo_orders")}</dt><dd className="text-right font-semibold">{s.promos.promoOrders}</dd>
          <dt className="text-ink/70">{t("gift_issued")}</dt><dd className="text-right font-semibold">{money(s.promos.giftCardsIssuedCents)}</dd>
          <dt className="text-ink/70">{t("gift_redeemed")}</dt><dd className="text-right font-semibold">{money(s.promos.giftCardRedeemedCents)}</dd>
          <dt className="text-ink/70">{t("funeral_share")}</dt>
          <dd className="text-right font-semibold">{t("funeral_share_value", { pct: s.promos.funeralSharePct, n: s.promos.funeralOrders })}</dd>
        </dl>
      </div>
      <div className={`${box} lg:col-span-2`}>
        <div className={head}>{t("products_revenue_title")}</div>
        {s.products.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink/50">
                <th className="py-1 font-normal">{t("col_product")}</th>
                <th className="py-1 text-right font-normal">{t("col_units")}</th>
                <th className="py-1 text-right font-normal">{t("col_revenue")}</th>
                <th className="py-1 text-right font-normal">{t("col_vs_prev")}</th>
              </tr>
            </thead>
            <tbody>
              {s.products.map((p) => (
                <tr key={p.key} className="border-t border-mute-100">
                  <td className="py-1.5">{p.key === "__custom__" ? t("custom_products") : p.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.qty}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{money(p.cents)}</td>
                  <td className="py-1.5 text-right text-xs">
                    {p.delta.kind === "pct" ? (
                      <span className={p.delta.pct >= 0 ? "text-success" : "text-error"}>{p.delta.pct >= 0 ? "▲" : "▼"} {Math.abs(p.delta.pct)}%</span>
                    ) : p.delta.kind === "new" ? (
                      <span className="text-success">{t("delta_new")}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className={box}>
        <div className={head}>{t("by_zone_title")}</div>
        {s.byZone.length === 0 ? (
          <p className="text-sm text-ink/50">{t("empty")}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {s.byZone.map((z) => (
                <tr key={z.zoneId} className="border-t border-mute-100 first:border-0">
                  <td className="py-1.5">{z.label}</td>
                  <td className="py-1.5 text-right text-xs text-ink/50">{z.orderCount}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{money(z.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
