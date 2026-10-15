"use client";
import { memo, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";
import type { Product, ProductImage as ProductImageT } from "@/types/product";
import { isNewArrival, startingPriceCents } from "@/data/product-helpers";
import { formatMoneyCents } from "@/lib/format";
import { fitInStage, productImageDims } from "@/lib/product-image-dims";
import { SPRING } from "@/lib/motion";

type Props = {
  product: Product;
  locale: Locale;
  reduceMotion?: boolean;
  priority?: boolean;
  campaign?: string;
};

/** Every card draws its photo inside a 3:4 stage, the catalog's native format. */
const STAGE_RATIO = 3 / 4;

const ASPECT_TAG: Record<ProductImageT["aspect"], number> = {
  "4/5": 4 / 5,
  "1/1": 1,
  "16/9": 16 / 9,
};

/**
 * The whole photo, uncropped, as large as the stage allows and resting on its
 * floor. Measured pixel sizes win; the catalog's coarse aspect tag is the fallback.
 */
function frameStyle(cover: ProductImageT): CSSProperties {
  const dims = productImageDims(cover.src) ?? { width: ASPECT_TAG[cover.aspect] ?? STAGE_RATIO, height: 1 };
  const { widthPct, heightPct } = fitInStage(dims, STAGE_RATIO);
  return { width: `${widthPct}%`, height: `${heightPct}%`, left: `${(100 - widthPct) / 2}%`, bottom: 0 };
}

function ProductCardImpl({ product, locale, reduceMotion, priority, campaign }: Props) {
  const t = useTranslations("product");
  const prefersReduced = useReducedMotion();
  const still = reduceMotion || prefersReduced;
  const base = `/${locale}/product/${product.slug}`;
  const href = campaign ? `${base}?campaign=${encodeURIComponent(campaign)}` : base;
  const cover = product.images[0];
  const fromPrice = formatMoneyCents(startingPriceCents(product), locale);
  const startingFrom = t("from_price");
  const eyebrow = isNewArrival(product)
    ? t("badge_new")
    : product.tags.includes("staff-pick")
      ? t("badge_staff_pick")
      : null;

  return (
    <Link href={href} data-testid="product-card" className="group block focus-visible:outline-none">
      <div data-testid="product-stage" className="relative aspect-[3/4]">
        {cover && (
          <motion.div
            data-testid="product-frame"
            className="absolute mask-x-from-90% mask-y-from-90%"
            style={frameStyle(cover)}
            whileHover={still ? undefined : { y: -8, scale: 1.02 }}
            transition={SPRING.default}
          >
            <Image
              src={cover.src}
              alt={cover.alt[locale]}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              priority={priority}
              className="object-contain"
            />
          </motion.div>
        )}
        {product.tags.includes("same-day") && (
          <span className="absolute bottom-3 left-3 rounded-full border border-ink/15 bg-bone/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink">
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
          {product.quoteOnly ? (
            <span className="text-rouge">{locale === "es" ? "Cotizar" : "Get a quote"}</span>
          ) : (
            <>
              <span className="text-mute-500 mr-1">{startingFrom}</span>
              {fromPrice}
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

export const ProductCard = memo(ProductCardImpl);
