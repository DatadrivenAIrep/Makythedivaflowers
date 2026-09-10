"use client";
import { useLocale } from "next-intl";
import { PRODUCTS } from "@/data/products";
import type { CartLine } from "@/types/order";

function money(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

export default function CartLines({ lines, onChangeLines }: { lines: CartLine[]; onChangeLines: (l: CartLine[]) => void }) {
  const locale = useLocale() as "en" | "es";
  function removeLine(i: number) { onChangeLines(lines.filter((_, idx) => idx !== i)); }
  return (
    <div className="bg-white border border-mute-100 rounded-2xl px-3.5">
      {lines.length === 0 && <div className="py-4 text-mute-400 text-sm">Sin productos todavía.</div>}
      {lines.map((l, i) => {
        const product = l.kind === "catalog" ? PRODUCTS.find((p) => p.id === l.productId) : undefined;
        const variant = l.kind === "catalog" ? product?.variants.find((v) => v.id === l.variantId) : undefined;
        const label = l.kind === "catalog" ? product?.title[locale] ?? l.productId : null;
        const unit = l.kind === "catalog" ? variant?.priceCents ?? 0 : l.priceCents;
        // Only worth showing when the piece comes in more than one size — otherwise
        // it is noise. With several sizes the operator has to be able to read back
        // which one was picked before the order goes out.
        const size = product && product.variants.length > 1 ? variant?.label[locale] : undefined;
        return (
          <div key={i} className="flex justify-between items-center py-2.5 text-sm border-b border-dashed border-mute-100 last:border-0">
            <span><span className="text-mute-400">{l.qty} ×</span>{" "}
              {l.kind === "catalog" ? label : <em className="not-italic font-display text-rouge italic">{l.title}</em>}
              {size && <span className="text-mute-400"> · {size}</span>}
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums">{money(unit * l.qty)}</span>
              <button type="button" onClick={() => removeLine(i)} className="text-mute-400 hover:text-rouge">✕</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
