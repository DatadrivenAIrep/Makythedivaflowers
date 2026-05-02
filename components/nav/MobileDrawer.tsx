"use client";
import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/nav/LocaleSwitcher";
import { CartButton } from "@/components/nav/CartButton";
import { CATS, LABELS } from "@/lib/shop-categories";
import type { Locale } from "@/types/locale";

const NAV_LINKS = (locale: Locale) => [
  { href: `/${locale}/weddings`, key: "weddings" },
  { href: `/${locale}/events`, key: "events" },
  { href: `/${locale}/story`, key: "story" },
  { href: `/${locale}/journal`, key: "journal" },
  { href: `/${locale}/contact`, key: "contact" },
];

export function MobileDrawer({
  isOpen,
  onClose,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const t = useTranslations("nav");

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            data-testid="drawer-overlay"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("open_menu")}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-y-0 right-0 w-[280px] bg-bone z-50 flex flex-col shadow-2xl"
          >
            {/* Close button */}
            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close_menu")}
                className="p-2 text-ink/60 hover:text-ink transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Nav content */}
            <nav className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Shop + category chips */}
              <div className="border-b border-ink/[0.08] pb-4 mb-1">
                <Link
                  href={`/${locale}/shop`}
                  onClick={onClose}
                  className="font-display text-xl text-ink block py-3"
                >
                  {t("shop")} →
                </Link>
                <div className="flex flex-wrap gap-2 pb-2">
                  {CATS.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/${locale}/shop/${c.slug}`}
                      onClick={onClose}
                      className="font-mono text-[11px] uppercase tracking-[0.12em] bg-ink/[0.05] rounded px-2 py-1 text-ink/70 hover:text-ink transition-colors"
                    >
                      {LABELS[c.slug][locale]}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Main links */}
              {NAV_LINKS(locale).map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  onClick={onClose}
                  className="font-display text-xl text-ink block py-3 border-b border-ink/[0.08]"
                >
                  {t(l.key as Parameters<typeof t>[0])}
                </Link>
              ))}
            </nav>

            {/* Bottom bar */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-ink/[0.08]">
              <LocaleSwitcher current={locale} />
              <CartButton locale={locale} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
