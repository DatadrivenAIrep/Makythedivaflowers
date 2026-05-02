"use client";
import { memo } from "react";
import { useTranslations } from "next-intl";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { formatMoneyCents } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
  value: string;
  onChange: (variantId: string) => void;
};

function VariantChipsImpl({ product, locale, value, onChange }: Props) {
  const tConv = useTranslations("conversion.variants");
  return (
    <div className="flex flex-wrap gap-2">
      {product.variants.map((v) => {
        const selected = v.id === value;
        return (
          <div key={v.id} className="flex flex-col gap-1">
            {v.id === "lush" && product.variants.length > 1 && (
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-rouge">
                {tConv("most_popular")}
              </span>
            )}
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(v.id)}
              className={cn(
                "inline-flex h-11 items-center gap-3 rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
                selected ? "border-transparent bg-ink text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              <span>{v.label[locale]}</span>
              <span className={cn("font-mono text-xs", selected ? "text-bone/80" : "text-mute-500")}>
                {formatMoneyCents(v.priceCents, locale)}
              </span>
            </button>
            {v.subtitle && (
              <small className="text-[11px] text-ink/60 leading-snug">
                {v.subtitle[locale]}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const VariantChips = memo(VariantChipsImpl);
