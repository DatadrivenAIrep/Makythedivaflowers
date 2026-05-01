"use client";
import { memo } from "react";
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
  return (
    <div className="flex flex-wrap gap-2">
      {product.variants.map((v) => {
        const selected = v.id === value;
        return (
          <button
            key={v.id}
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
        );
      })}
    </div>
  );
}

export const VariantChips = memo(VariantChipsImpl);
