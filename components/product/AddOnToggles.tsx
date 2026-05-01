"use client";
import { memo } from "react";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { formatMoneyCents } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
  value: string[];
  onChange: (next: string[]) => void;
};

function AddOnTogglesImpl({ product, locale, value, onChange }: Props) {
  if (!product.addOns || product.addOns.length === 0) return null;
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {locale === "es" ? "Acompañamientos" : "Add-ons"}
      </p>
      <div className="flex flex-wrap gap-2">
        {product.addOns.map((a) => {
          const selected = value.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(a.id)}
              className={cn(
                "inline-flex h-10 items-center gap-3 rounded-full border px-4 font-sans text-sm tracking-tight transition-colors",
                selected ? "border-transparent bg-rouge text-bone" : "border-ink/15 text-ink/85 hover:border-ink/40",
              )}
            >
              <span>{a.label[locale]}</span>
              <span className={cn("font-mono text-xs", selected ? "text-bone/85" : "text-mute-500")}>
                +{formatMoneyCents(a.priceCents, locale)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const AddOnToggles = memo(AddOnTogglesImpl);
