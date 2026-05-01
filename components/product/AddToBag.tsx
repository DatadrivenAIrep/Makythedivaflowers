"use client";
import { memo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/lib/cart-store";
import { formatMoneyCents } from "@/lib/format";
import type { Locale } from "@/types/locale";

type Props = {
  productId: string;
  variantId: string;
  addOnIds: string[];
  totalCents: number;
  disabled?: boolean;
  locale: Locale;
};

function AddToBagImpl({ productId, variantId, addOnIds, totalCents, disabled, locale }: Props) {
  const add = useCartStore((s) => s.add);
  const [state, setState] = useState<"idle" | "added">("idle");
  const reduce = useReducedMotion();

  const onClick = () => {
    if (disabled) return;
    add({ productId, variantId, addOnIds, qty: 1 });
    setState("added");
    window.setTimeout(() => setState("idle"), 1800);
  };

  const idleLabel = locale === "es" ? "Añadir a la bolsa" : "Add to bag";
  const addedLabel = locale === "es" ? "Añadido" : "Added";

  return (
    <Button
      variant="primary"
      size="lg"
      disabled={disabled || state === "added"}
      onClick={onClick}
      className="w-full justify-between"
    >
      <AnimatePresence mode="wait">
        {state === "idle" ? (
          <motion.span
            key="idle"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {idleLabel}
          </motion.span>
        ) : (
          <motion.span
            key="added"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            ✓ {addedLabel}
          </motion.span>
        )}
      </AnimatePresence>
      <span className="font-mono text-base">{formatMoneyCents(totalCents, locale)}</span>
    </Button>
  );
}

export const AddToBag = memo(AddToBagImpl);
