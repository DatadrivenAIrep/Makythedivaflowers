// components/cart/ToastAddedToBag.tsx
"use client";
import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { useUIStore } from "@/lib/ui-store";
import { springs } from "@/lib/motion-config";

export function ToastAddedToBag() {
  const t = useTranslations("cart");
  const toast = useUIStore((s) => s.toast);
  const clear = useUIStore((s) => s.clearToast);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clear, 3500);
    return () => clearTimeout(id);
  }, [toast, clear]);

  return (
    <AnimatePresence>
      {toast?.kind === "added-to-bag" && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-bone shadow-lg"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={reduce ? { duration: 0 } : springs.soft}
        >
          <Check size={14} />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{t("toast_added")}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
