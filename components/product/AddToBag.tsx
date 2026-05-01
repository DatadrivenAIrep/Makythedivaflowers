"use client";
import { memo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
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
  const showToast = useUIStore((s) => s.showToast);
  const openDrawer = useUIStore((s) => s.openDrawer);
  const [state, setState] = useState<"idle" | "added">("idle");
  const reduce = useReducedMotion();
  const t = useTranslations("product");

  const onClick = () => {
    if (disabled) return;
    add({ productId, variantId, addOnIds, qty: 1 });
    showToast({ kind: "added-to-bag", productId });
    openDrawer();
    setState("added");
    window.setTimeout(() => setState("idle"), 1800);
  };

  const idleLabel = t("add_to_bag");
  const addedLabel = t("added");

  return (
    <MagneticButton
      type="button"
      disabled={disabled || state === "added"}
      onClick={onClick}
      className="w-full justify-between"
      wrapperClassName="w-full"
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
    </MagneticButton>
  );
}

export const AddToBag = memo(AddToBagImpl);
