"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photos: PortfolioPhoto[];
  locale: Locale;
  onOpen: (index: number) => void;
};

const TILE_HEIGHTS = [220, 280, 200, 260, 240];

export function GalleryMarquee({ photos, locale, onOpen }: Props) {
  const t = useTranslations("weddings.gallery");
  const reducedMotionPref = useReducedMotion();
  // Avoid SSR/client hydration mismatch: treat as animated until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const reduce = mounted ? reducedMotionPref : false;

  const renderRow = (keyPrefix: string) =>
    photos.map((photo, i) => {
      const h = TILE_HEIGHTS[i % TILE_HEIGHTS.length];
      const w = Math.round(h * 1.4);
      return (
        <button
          key={`${keyPrefix}-${photo.id}`}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={photo.alt[locale]}
          className="relative shrink-0 overflow-hidden rounded-xl bg-bone"
          style={{ height: h, width: w }}
        >
          <Image
            src={photo.src}
            alt=""
            fill
            sizes="30vw"
            className="object-cover transition-transform duration-500 hover:scale-[1.04] motion-reduce:transition-none motion-reduce:hover:scale-100"
          />
        </button>
      );
    });

  return (
    <section
      role="region"
      aria-label={t("marquee_label")}
      className="marquee-container relative w-full overflow-hidden py-12"
    >
      <div
        className={reduce ? "flex gap-4 overflow-x-auto pb-4" : "flex gap-4 marquee-track"}
        style={reduce ? undefined : { width: "max-content" }}
      >
        {renderRow("a")}
        {!reduce && renderRow("b")}
      </div>
    </section>
  );
}
