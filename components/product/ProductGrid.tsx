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
};

const fadeOnly = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

function ProductGridImpl({ products, locale, motionMode = "default", className }: Props) {
  const itemVariants = motionMode === "sympathy" ? fadeOnly : staggerItemVariants;
  return (
    <StaggerGroup
      className={
        className ??
        "grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 md:gap-y-16 lg:grid-cols-3"
      }
    >
      {products.map((p, i) => (
        <motion.div key={p.id} variants={itemVariants}>
          <ProductCard
            product={p}
            locale={locale}
            reduceMotion={motionMode === "sympathy"}
            priority={i < 3}
          />
        </motion.div>
      ))}
    </StaggerGroup>
  );
}

export const ProductGrid = memo(ProductGridImpl);
