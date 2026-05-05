"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartEmpty } from "@/components/cart/CartEmpty";
import { CartUpsellStrip } from "@/components/conversion/CartUpsellStrip";
import { Button } from "@/components/ui/Button";
import { formatMoneyCents } from "@/lib/format";
import { PRODUCTS } from "@/data/products";
import type { Locale } from "@/types/locale";
import { trackRemoveFromCart } from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";

export function CartPageList({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const resolved = useMemo(() => resolveCartLines(lines, PRODUCTS), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, PRODUCTS), [lines]);

  if (resolved.length === 0) {
    return <CartEmpty locale={locale} />;
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-16">
      <div>
        <ul className="divide-y divide-ink/10">
          {resolved.map((r) => (
            <CartLineItem
              key={`${r.line.productId}-${r.line.variantId}`}
              resolved={r}
              locale={locale}
              variant="page"
              onQtyChange={(n) => setQty(r.line.productId, r.line.variantId, n)}
              onRemove={() => {
                trackRemoveFromCart(resolvedLineToAnalyticsItem(r));
                remove(r.line.productId, r.line.variantId);
              }}
            />
          ))}
        </ul>
        <CartUpsellStrip locale={locale} />
      </div>
      <aside className="lg:sticky lg:top-24 self-start space-y-5 rounded-2xl border border-ink/10 p-6">
        <p className="font-display text-xl text-ink">{t("summary_title")}</p>
        <div className="flex items-baseline justify-between border-t border-ink/10 pt-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60">{t("subtotal")}</span>
          <span className="font-mono text-base tabular-nums text-ink">{formatMoneyCents(subtotal, locale)}</span>
        </div>
        <p className="text-[11px] text-ink/55 leading-snug">{t("calculated_at_checkout")}</p>
        <Button asChild variant="primary" className="w-full">
          <Link href={`/${locale}/checkout`}>{t("checkout_cta")}</Link>
        </Button>
      </aside>
    </div>
  );
}
