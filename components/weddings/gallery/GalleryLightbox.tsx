"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photos: PortfolioPhoto[];
  activeIndex: number | null;
  locale: Locale;
  onClose: () => void;
  onChange: (next: number) => void;
};

export function GalleryLightbox({ photos, activeIndex, locale, onClose, onChange }: Props) {
  const t = useTranslations("weddings.gallery");
  const reduce = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onChangeRef = useRef(onChange);
  // Keep refs current without re-running the keyboard effect
  useEffect(() => {
    onCloseRef.current = onClose;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (activeIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "ArrowRight") onChangeRef.current((activeIndex + 1) % photos.length);
      if (e.key === "ArrowLeft") onChangeRef.current((activeIndex - 1 + photos.length) % photos.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeIndex, photos.length]);

  const active = activeIndex === null ? null : photos[activeIndex];

  return (
    <AnimatePresence>
      {active && activeIndex !== null && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt[locale]}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 backdrop-blur-xl p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.25 }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_70%)]" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute top-6 right-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={() => onChange((activeIndex - 1 + photos.length) % photos.length)}
            aria-label={t("prev")}
            className="absolute left-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <CaretLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => onChange((activeIndex + 1) % photos.length)}
            aria-label={t("next")}
            className="absolute right-6 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone hover:bg-bone/20"
          >
            <CaretRight size={18} />
          </button>
          <motion.div
            layoutId={reduce ? undefined : `gallery-${active.id}`}
            className="relative h-[90vh] w-[90vw]"
          >
            <Image
              src={active.src}
              alt={active.alt[locale]}
              fill
              sizes="90vw"
              priority
              className="object-contain"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
