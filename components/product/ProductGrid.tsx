// components/product/ProductGrid.tsx
"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { StaggerGroup, staggerItemVariants } from "@/components/motion/StaggerGroup";
import { ProductCard } from "./ProductCard";
import type { Locale } from "@/types/locale";
import type { Product } from "@/types/product";

type Props = {
  products: Product[];
  locale: Locale;
  /** sympathy = fade-only stagger, no bloom */
  motionMode?: "default" | "sympathy";
  className?: string;
  /** Classes for each card's wrapper, e.g. a fixed width inside a swipe row. */
  itemClassName?: string;
  /** How many leading photos load eagerly; 0 when the grid starts below the fold. */
  priorityCount?: number;
  campaign?: string;
};

const fadeOnly = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

function ProductGridImpl({
  products,
  locale,
  motionMode = "default",
  className,
  itemClassName,
  priorityCount = 3,
  campaign,
}: Props) {
  const itemVariants = motionMode === "sympathy" ? fadeOnly : staggerItemVariants;
  return (
    // Full-bleed plaster band (the photos' own background tone) so the uncropped
    // covers float on it with no visible frame. The band breaks out of the page
    // container with a viewport-wide pseudo-element painted behind the grid.
    <div
      data-testid="product-band"
      className="relative isolate py-10 before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:bg-mute-100 before:content-[''] md:py-14"
    >
      <StaggerGroup
        className={
          className ??
          "grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 md:gap-y-16 lg:grid-cols-3"
        }
      >
        {products.map((p, i) => (
          <motion.div key={p.id} variants={itemVariants} className={itemClassName}>
            <ProductCard
              product={p}
              locale={locale}
              reduceMotion={motionMode === "sympathy"}
              priority={i < priorityCount}
              campaign={campaign}
            />
          </motion.div>
        ))}
      </StaggerGroup>
    </div>
  );
}

export const ProductGrid = memo(ProductGridImpl);
