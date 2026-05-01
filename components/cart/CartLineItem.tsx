"use client";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { ProductImage } from "@/components/product/ProductImage";
import { CartLineQty } from "@/components/cart/CartLineQty";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";
import type { ResolvedCartLine } from "@/lib/cart-helpers";

type Props = {
  resolved: ResolvedCartLine;
  locale: Locale;
  onQtyChange: (next: number) => void;
  onRemove: () => void;
  variant?: "drawer" | "page";
};

export function CartLineItem({ resolved, locale, onQtyChange, onRemove, variant = "drawer" }: Props) {
  const t = useTranslations("cart");
  const { product, variant: v, addOns, lineTotalCents } = resolved;
  const image = product.images[0];
  const isPage = variant === "page";
  return (
    <li
      className={`grid gap-3 ${
        isPage ? "grid-cols-[100px_1fr_auto] py-6 border-b border-ink/10 last:border-0" : "grid-cols-[64px_1fr_auto] py-3"
      }`}
    >
      <div className={`overflow-hidden rounded-xl bg-bone ${isPage ? "aspect-[4/5]" : "aspect-square h-16"}`}>
        <ProductImage
          image={image}
          locale={locale}
          sizes={isPage ? "100px" : "64px"}
        />
      </div>
      <div className="flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          <p className={`font-display ${isPage ? "text-lg" : "text-sm"} text-ink truncate leading-tight`}>
            {product.title[locale]}
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60 mt-0.5">
            {v.label[locale]}
            {addOns.length > 0 && <> · {addOns.map((a) => a.label[locale]).join(" · ")}</>}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <CartLineQty qty={resolved.line.qty} onChange={onQtyChange} />
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60 hover:text-rouge"
          >
            <X size={12} />
            {t("remove")}
          </button>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm tabular-nums text-ink">
          {formatMoneyCents(lineTotalCents, locale)}
        </p>
      </div>
    </li>
  );
}
