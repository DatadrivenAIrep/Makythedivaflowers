// components/conversion/CartUpsellStrip.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { suggestExtrasForCart } from "@/data/gift-extras";
import { usePricedProducts } from "@/components/catalog/PricedCatalog";
import { formatMoneyCents } from "@/lib/format";
import { CONV_EVENTS } from "@/lib/conversion/events";
import { DIGITAL_CARD_ID } from "@/lib/digital-card-offer";
import { PromoLoop } from "@/components/digital-cards/PromoVideo";
import { cn } from "@/lib/cn";
import type { Locale } from "@/types/locale";

type Props = {
  locale: Locale;
};

export function CartUpsellStrip({ locale }: Props) {
  const products = usePricedProducts();
  const t = useTranslations("conversion.upsell");
  const lines = useCartStore((s) => s.lines);
  const add = useCartStore((s) => s.add);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  if (lines.length === 0) return null;

  const suggestions = suggestExtrasForCart(lines, products);
  // The digital card is the extra customers take most, so it gets its own card
  // with the moving promo instead of a text chip. It stays up for a moment after
  // it is added (showing "Added") rather than vanishing under the buyer's thumb.
  const digitalCard = products.find((p) => p.id === DIGITAL_CARD_ID);
  const showDigital =
    Boolean(digitalCard) && (suggestions.includes(DIGITAL_CARD_ID) || recentlyAdded === DIGITAL_CARD_ID);
  const chips = suggestions.filter((id) => id !== DIGITAL_CARD_ID);
  if (!showDigital && chips.length === 0) return null;

  const onAdd = (extraId: string) => {
    const product = products.find((p) => p.id === extraId);
    if (!product) return;
    const variant = product.variants[0];
    if (!variant) return;
    add({ kind: "catalog", productId: product.id, variantId: variant.id, addOnIds: [], qty: 1 });
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
      {showDigital && digitalCard && (
        <DigitalCardRow
          locale={locale}
          priceCents={digitalCard.variants[0]?.priceCents ?? 0}
          added={recentlyAdded === DIGITAL_CARD_ID}
          onAdd={() => onAdd(DIGITAL_CARD_ID)}
        />
      )}
      {chips.length > 0 && (
        <ul
          className={cn("flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 snap-x snap-mandatory", showDigital && "mt-3")}
          role="list"
        >
          {chips.map((extraId) => {
            const product = products.find((p) => p.id === extraId);
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
      )}
    </div>
  );
}

/** The digital card offer in the cart: a small dark card with the looping promo, like the one on the product page. */
function DigitalCardRow({
  locale,
  priceCents,
  added,
  onAdd,
}: {
  locale: Locale;
  priceCents: number;
  added: boolean;
  onAdd: () => void;
}) {
  const t = useTranslations("conversion.upsell");
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const price = formatMoneyCents(priceCents, locale);
  return (
    <section
      aria-labelledby="cart-digital-card"
      data-testid="cart-digital-card"
      className="flex items-center gap-3 rounded-2xl bg-ink p-2.5 pr-3 text-bone"
    >
      <div className="relative h-[72px] w-[44px] shrink-0 overflow-hidden rounded-lg bg-charcoal">
        <PromoLoop locale={locale} shape="9x16" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-petal">{t("digital_eyebrow")}</p>
        <p id="cart-digital-card" className="font-sans text-[13px] leading-snug text-bone/90">
          {t("digital_body")}{" "}
          <Link
            href={`/${locale}/digital-cards`}
            onClick={closeDrawer}
            className="whitespace-nowrap text-bone/70 underline underline-offset-4 hover:text-bone"
          >
            {t("digital_how")}
          </Link>
        </p>
      </div>
      <button
        type="button"
        disabled={added}
        aria-label={added ? undefined : t("digital_add_aria", { price })}
        data-conv-event={added ? CONV_EVENTS.upsell.add : undefined}
        onClick={onAdd}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-sans text-sm font-medium transition-colors",
          added ? "bg-petal text-ink" : "bg-bone text-ink hover:bg-bone/90",
        )}
      >
        {added ? (
          <span aria-live="polite">✓ {t("digital_added")}</span>
        ) : (
          <>
            <span>{t("digital_add")}</span>
            <span className="font-mono text-xs text-ink/65">+{price}</span>
          </>
        )}
      </button>
    </section>
  );
}
