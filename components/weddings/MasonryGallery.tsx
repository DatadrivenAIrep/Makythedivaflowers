// components/weddings/MasonryGallery.tsx
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { weddingPortfolio, type PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

function aspectDimensions(aspect: PortfolioPhoto["aspect"]): [number, number] {
  switch (aspect) {
    case "1/1":  return [1200, 1200];
    case "16/9": return [2400, 1350];
    case "3/4":  return [1500, 2000];
    case "4/5":
    default:     return [1200, 1500];
  }
}

export function MasonryGallery({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.gallery");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIdx(null);
      if (e.key === "ArrowRight") setActiveIdx((i) => i === null ? null : (i + 1) % weddingPortfolio.length);
      if (e.key === "ArrowLeft") setActiveIdx((i) => i === null ? null : (i - 1 + weddingPortfolio.length) % weddingPortfolio.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIdx]);

  const active: PortfolioPhoto | null = activeIdx === null ? null : weddingPortfolio[activeIdx];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <div className="columns-2 md:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {weddingPortfolio.map((photo, i) => {
            const [w, h] = aspectDimensions(photo.aspect);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={photo.alt[locale]}
                className="group block w-full overflow-hidden rounded-2xl bg-bone"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt[locale]}
                  width={w}
                  height={h}
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </button>
            );
          })}
        </div>
      </div>
      <AnimatePresence>
        {active && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={active.alt[locale]}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 backdrop-blur-md p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
          >
            <button type="button" onClick={() => setActiveIdx(null)} aria-label={t("close")}
              className="absolute top-6 right-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20">
              <X size={18} />
            </button>
            <button type="button" onClick={() => setActiveIdx((i) => i === null ? null : (i - 1 + weddingPortfolio.length) % weddingPortfolio.length)} aria-label={t("prev")}
              className="absolute left-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20">
              <CaretLeft size={18} />
            </button>
            <button type="button" onClick={() => setActiveIdx((i) => i === null ? null : (i + 1) % weddingPortfolio.length)} aria-label={t("next")}
              className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20">
              <CaretRight size={18} />
            </button>
            <div className="relative h-[90vh] w-[90vw]">
              {(() => { const [lw, lh] = aspectDimensions(active.aspect); return (
                <Image src={active.src} alt={active.alt[locale]} width={lw} height={lh} sizes="90vw" className="h-full w-full object-contain" priority />
              ); })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
