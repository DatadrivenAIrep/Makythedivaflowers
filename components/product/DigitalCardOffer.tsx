"use client";
import { memo } from "react";
import Link from "next/link";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { formatMoneyCents } from "@/lib/format";
import { addOnsForProduct } from "@/lib/product-add-ons";
import { DIGITAL_CARD_ID } from "@/lib/digital-card-offer";
import { PromoLoop } from "@/components/digital-cards/PromoVideo";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
  value: string[];
  onChange: (next: string[]) => void;
};

/**
 * The digital card, shown where the buyer is deciding what to say: under the card
 * message. Same add-on as the chip in AddOnToggles (one `addOnIds` state), so the
 * two always agree; only offered where `addOnsForProduct` offers it.
 */
function DigitalCardOfferImpl({ product, locale, value, onChange }: Props) {
  const offer = addOnsForProduct(product).find((a) => a.id === DIGITAL_CARD_ID);
  if (!offer) return null;
  const es = locale === "es";
  const selected = value.includes(DIGITAL_CARD_ID);
  const toggle = () =>
    onChange(selected ? value.filter((v) => v !== DIGITAL_CARD_ID) : [...value, DIGITAL_CARD_ID]);

  return (
    <section aria-labelledby="digital-card-offer" className="flex gap-4 rounded-2xl bg-ink p-3 text-bone">
      <div className="relative aspect-[9/16] w-[84px] shrink-0 overflow-hidden rounded-xl bg-charcoal">
        <PromoLoop locale={locale} shape="9x16" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-2 py-1 pr-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-petal">
          {es ? "Nuevo · Tarjeta digital" : "New · Digital card"}
        </p>
        <p id="digital-card-offer" className="font-sans text-sm leading-snug text-bone/90">
          {es
            ? "Su tarjeta cobra vida: escanean el QR de la tarjeta y se abre en su teléfono, con sus nombres, tu carta y tus fotos."
            : "Their card comes alive: they scan the QR on the card and it opens on their phone, with their names, your letter and your photos."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={selected}
            onClick={toggle}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 font-sans text-sm font-medium transition-colors",
              selected ? "bg-petal text-ink" : "bg-bone text-ink hover:bg-bone/90",
            )}
          >
            <span>{selected ? (es ? "✓ Añadida" : "✓ Added") : es ? "Añadir" : "Add"}</span>
            <span className="font-mono text-xs text-ink/65">+{formatMoneyCents(offer.priceCents, locale)}</span>
          </button>
          <Link
            href={`/${locale}/digital-cards`}
            className="font-sans text-xs text-bone/75 underline underline-offset-4 transition-colors hover:text-bone"
          >
            {es ? "Cómo funciona" : "How it works"}
          </Link>
        </div>
      </div>
    </section>
  );
}

export const DigitalCardOffer = memo(DigitalCardOfferImpl);
