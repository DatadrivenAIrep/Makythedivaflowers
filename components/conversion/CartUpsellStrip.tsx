// components/conversion/CartUpsellStrip.tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { suggestExtrasForCart } from "@/data/gift-extras";
import { PRODUCTS } from "@/data/products";
import { formatMoneyCents } from "@/lib/format";
import { CONV_EVENTS } from "@/lib/conversion/events";
import { cn } from "@/lib/cn";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
};

export function CartUpsellStrip({ locale }: Props) {
  const t = useTranslations("conversion.upsell");
  const lines = useCartStore((s) => s.lines);
  const add = useCartStore((s) => s.add);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  if (lines.length === 0) return null;

  const suggestions = suggestExtrasForCart(lines, PRODUCTS);
  if (suggestions.length === 0) return null;

  const onAdd = (extraId: string) => {
    const product = PRODUCTS.find((p) => p.id === extraId);
    if (!product) return;
    const variant = product.variants[0];
    if (!variant) return;
    add({ productId: product.id, variantId: variant.id, addOnIds: [], qty: 1 });
    setRecentlyAdded(extraId);
    setTimeout(() => setRecentlyAdded(null), 2000);
  };

  return (
    <div
      data-conv-event={CONV_EVENTS.upsell.view}
      className="border-t border-ink/10 px-5 py-4"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute-500 mb-3">
        {t("title")}
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory" role="list">
        {suggestions.map((extraId) => {
          const product = PRODUCTS.find((p) => p.id === extraId);
          if (!product) return null;
          const variant = product.variants[0];
          if (!variant) return null;
          const justAdded = recentlyAdded === extraId;
          const price = formatMoneyCents(variant.priceCents, locale);
          return (
            <li key={extraId} className="snap-start">
              <button
                type="button"
                disabled={justAdded}
                aria-label={t("add_aria", { item: product.title[locale], price })}
                data-conv-event={justAdded ? CONV_EVENTS.upsell.add : undefined}
                onClick={() => onAdd(extraId)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors",
                  justAdded
                    ? "border-rouge bg-rouge text-bone"
                    : "border-ink/15 text-ink hover:border-ink/40",
                )}
              >
                {justAdded ? (
                  <span aria-live="polite">✓ {t("added_label")}</span>
                ) : (
                  <>
                    <span>{product.title[locale]}</span>
                    <span className="font-mono text-xs text-ink/60">+{price}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
