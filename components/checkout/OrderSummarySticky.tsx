// components/checkout/OrderSummarySticky.tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { computeOrderTotals } from "@/lib/totals";
import { formatMoneyCents } from "@/lib/format";
import { ProductImage } from "@/components/product/ProductImage";
import { PRODUCTS } from "@/data/products";
import type { Locale } from "@/types/locale";

export function OrderSummarySticky({ locale }: { locale: Locale }) {
  const t = useTranslations("checkout");
  const lines = useCartStore((s) => s.lines);
  const resolved = useMemo(() => resolveCartLines(lines, PRODUCTS), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, PRODUCTS), [lines]);
  const totals = useMemo(() => computeOrderTotals(subtotal), [subtotal]);

  return (
    <aside className="lg:sticky lg:top-24 self-start space-y-6 rounded-2xl border border-ink/10 p-6 bg-bone/60">
      <p className="font-display text-xl text-ink">{t("summary")}</p>
      <ul className="space-y-4 max-h-[280px] overflow-y-auto pr-1">
        {resolved.map((r) => (
          <li key={`${r.line.productId}-${r.line.variantId}`} className="grid grid-cols-[48px_1fr_auto] gap-3 items-center">
            <div className="aspect-square h-12 overflow-hidden rounded-lg bg-bone">
              <ProductImage image={r.product.images[0]} locale={locale} sizes="48px" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-ink truncate">{r.product.title[locale]}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/55">
                {r.variant.label[locale]} · ×{r.line.qty}
              </p>
            </div>
            <span className="font-mono text-sm tabular-nums text-ink">{formatMoneyCents(r.lineTotalCents, locale)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t border-ink/10 pt-4 font-mono text-[12px]">
        <Row label={t("subtotal")} value={formatMoneyCents(totals.subtotalCents, locale)} />
        <Row label={t("delivery")} value={formatMoneyCents(totals.deliveryCents, locale)} />
        <Row label={t("tax")} value={formatMoneyCents(totals.taxCents, locale)} />
        <div className="h-px bg-ink/10" />
        <Row label={t("total")} value={formatMoneyCents(totals.totalCents, locale)} bold />
      </dl>
    </aside>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="uppercase tracking-[0.18em] text-ink/60">{label}</dt>
      <dd className={`tabular-nums ${bold ? "text-ink text-base" : "text-ink/80"}`}>{value}</dd>
    </div>
  );
}
