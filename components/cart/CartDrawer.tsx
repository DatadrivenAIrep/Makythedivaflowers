// components/cart/CartDrawer.tsx
"use client";
import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCartStore } from "@/lib/cart-store";
import { useUIStore } from "@/lib/ui-store";
import { resolveCartLines, cartSubtotalCents } from "@/lib/cart-helpers";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { CartEmpty } from "@/components/cart/CartEmpty";
import { CartSummary } from "@/components/cart/CartSummary";
import { PRODUCTS } from "@/data/products";
import type { Locale } from "@/types/locale";
import { springs } from "@/lib/motion-config";
import { CutoffPill } from "@/components/conversion/CutoffPill";
import { GiftAssuranceBar } from "@/components/conversion/GiftAssuranceBar";
import { CartUpsellStrip } from "@/components/conversion/CartUpsellStrip";
import { SITE } from "@/data/site";
import { trackViewCart, trackRemoveFromCart } from "@/lib/analytics";
import { resolvedLineToAnalyticsItem } from "@/lib/analytics-types";

export function CartDrawer({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const lines = useCartStore((s) => s.lines);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const open = useUIStore((s) => s.drawerOpen);
  const close = useUIStore((s) => s.closeDrawer);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);

  const resolved = useMemo(() => resolveCartLines(lines, PRODUCTS), [lines]);
  const subtotal = useMemo(() => cartSubtotalCents(lines, PRODUCTS), [lines]);

  useEffect(() => {
    if (!open) return;
    trackViewCart(resolved.map(resolvedLineToAnalyticsItem));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label={t("close")}
            onClick={close}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.18 }}
          />
          <motion.aside
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("title")}
            className="fixed right-0 top-0 z-50 h-[100dvh] w-full max-w-[440px] bg-bone/85 backdrop-blur-xl border-l border-ink/10 shadow-[0_8px_60px_-16px_rgba(184,52,94,0.18)] flex flex-col outline-none"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={reduce ? { duration: 0 } : springs.snappy}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-ink/10">
              <div className="flex items-center gap-3">
                <p className="font-display text-xl text-ink">{t("title")}</p>
                <CutoffPill cutoff={SITE.cutoff24} locale={locale} />
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/${locale}/cart`}
                  onClick={close}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/60 hover:text-ink"
                >
                  {t("view_full")}
                </Link>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t("close")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-ink/5"
                >
                  <X size={16} />
                </button>
              </div>
            </header>
            {resolved.length === 0 ? (
              <CartEmpty locale={locale} onClose={close} />
            ) : (
              <>
                <ul className="flex-1 overflow-y-auto px-5 divide-y divide-ink/5">
                  {resolved.map((r) => (
                    <CartLineItem
                      key={`${r.line.productId}-${r.line.variantId}`}
                      resolved={r}
                      locale={locale}
                      onQtyChange={(n) => setQty(r.line.productId, r.line.variantId, n)}
                      onRemove={() => {
                        trackRemoveFromCart(resolvedLineToAnalyticsItem(r));
                        remove(r.line.productId, r.line.variantId);
                      }}
                    />
                  ))}
                </ul>
                <CartUpsellStrip locale={locale} />
                <div className="px-5 pt-3">
                  <GiftAssuranceBar size="sm" surface="cart" locale={locale} />
                </div>
                <CartSummary subtotalCents={subtotal} locale={locale} onCheckout={close} />
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
