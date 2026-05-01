"use client";
import { memo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";
import type { Product } from "@/types/product";
import { ProductImage } from "./ProductImage";
import { BloomImage } from "@/components/motion/BloomImage";
import { startingPriceCents } from "@/data/product-helpers";
import { formatMoneyCents } from "@/lib/format";

type Props = {
  product: Product;
  locale: Locale;
  reduceMotion?: boolean;
  priority?: boolean;
};

function ProductCardImpl({ product, locale, reduceMotion, priority }: Props) {
  const t = useTranslations("product");
  const href = `/${locale}/product/${product.slug}`;
  const cover = product.images[0];
  const fromPrice = formatMoneyCents(startingPriceCents(product), locale);
  const startingFrom = t("from_price");
  const eyebrow = product.tags.includes("new")
    ? t("badge_new")
    : product.tags.includes("staff-pick")
      ? t("badge_staff_pick")
      : null;

  return (
    <Link href={href} data-testid="product-card" className="group block focus-visible:outline-none">
      <div className="relative overflow-hidden rounded-[var(--radius-product)] bg-mute-100">
        {cover && reduceMotion ? (
          <ProductImage
            image={cover}
            locale={locale}
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          />
        ) : cover ? (
          <BloomImage
            src={cover.src}
            alt={cover.alt[locale]}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="aspect-[4/5]"
            priority={priority}
          />
        ) : null}
        {product.tags.includes("same-day") && (
          <span className="absolute left-3 top-3 rounded-full border border-ink/15 bg-bone/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink">
            {t("badge_today")}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
              {eyebrow}
            </p>
          )}
          <h3 className="truncate font-display text-xl leading-none text-ink group-hover:text-rouge transition-colors">
            {product.title[locale]}
          </h3>
        </div>
        <p className="shrink-0 font-mono text-sm text-ink">
          <span className="text-mute-500 mr-1">{startingFrom}</span>
          {fromPrice}
        </p>
      </div>
    </Link>
  );
}

export const ProductCard = memo(ProductCardImpl);
