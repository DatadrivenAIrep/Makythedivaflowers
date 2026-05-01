// components/weddings/WeddingsFAQ.tsx
"use client";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { weddingFAQ } from "@/data/wedding-faq";
import type { Locale } from "@/types/locale";
import { springs } from "@/lib/motion-config";

export function WeddingsFAQ({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.faq");
  const [openId, setOpenId] = useState<string | null>(null);
  const reduce = useReducedMotion();
  return (
    <section className="py-24 bg-bone">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <header className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <ul className="border-t border-ink/10">
          {weddingFAQ.map((item) => {
            const isOpen = openId === item.id;
            return (
              <li key={item.id} className="border-b border-ink/10">
                <button type="button" onClick={() => setOpenId(isOpen ? null : item.id)} aria-expanded={isOpen}
                  className="w-full flex items-start gap-6 py-6 text-left">
                  <span className="flex-1 font-display text-2xl text-ink leading-tight">{item.q[locale]}</span>
                  <Plus size={18} className={`mt-1 transition-transform ${isOpen ? "rotate-45" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div key="body"
                      initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={reduce ? { duration: 0 } : springs.soft}
                      className="overflow-hidden">
                      <p className="pb-6 pr-12 text-base text-ink/75 leading-relaxed">{item.a[locale]}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
