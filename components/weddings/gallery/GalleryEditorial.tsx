"use client";
import { useState } from "react";
import { LayoutGroup } from "framer-motion";
import { useTranslations } from "next-intl";
import { weddingPortfolio } from "@/data/wedding-portfolio";
import { GalleryCarousel } from "./GalleryCarousel";
import { GalleryLightbox } from "./GalleryLightbox";
import type { Locale } from "@/types/locale";

export function GalleryEditorial({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.gallery");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <LayoutGroup>
      <section className="py-16 sm:py-20">
        <header className="mx-auto max-w-7xl px-4 sm:px-6 mb-8 sm:mb-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <GalleryCarousel
          photos={weddingPortfolio}
          locale={locale}
          onOpen={setActiveIndex}
        />
      </section>
      <GalleryLightbox
        photos={weddingPortfolio}
        activeIndex={activeIndex}
        locale={locale}
        onClose={() => setActiveIndex(null)}
        onChange={setActiveIndex}
      />
    </LayoutGroup>
  );
}
