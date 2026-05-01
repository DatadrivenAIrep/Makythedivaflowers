// components/product/ImageStack.tsx
"use client";
import { useState, memo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";

type Props = {
  product: Product;
  locale: Locale;
};

function ImageStackImpl({ product, locale }: Props) {
  const reduce = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(0);
  const active = product.images[activeIdx];
  if (!active) return null;
  const aspect =
    active.aspect === "1/1"
      ? "aspect-square"
      : active.aspect === "16/9"
        ? "aspect-video"
        : "aspect-[4/5]";

  return (
    <div>
      <div className={cn("relative overflow-hidden rounded-[var(--radius-product)] bg-mute-100", aspect)}>
        <AnimatePresence mode="wait">
          <motion.img
            key={active.src}
            src={active.src}
            alt={active.alt[locale]}
            className="absolute inset-0 size-full object-cover"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </AnimatePresence>
      </div>
      {product.images.length > 1 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {product.images.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={img.alt[locale]}
              aria-current={i === activeIdx}
              className={cn(
                "aspect-square overflow-hidden rounded-[var(--radius-product)] border transition-colors",
                i === activeIdx ? "border-ink/45" : "border-ink/10 hover:border-ink/25",
              )}
            >
              <img src={img.src} alt={img.alt[locale]} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const ImageStack = memo(ImageStackImpl);
