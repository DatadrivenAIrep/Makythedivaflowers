"use client";
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
  const reduce = useReducedMotion();

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
            alt={photo.alt[locale]}
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
      className="relative w-full overflow-hidden py-12 group"
    >
      <div
        className={reduce ? "flex gap-4 overflow-x-auto pb-4" : "flex gap-4 marquee-track"}
        style={reduce ? undefined : { width: "max-content" }}
      >
        {renderRow("a")}
        {!reduce && renderRow("b")}
      </div>
      {!reduce && (
        <style>{`
          .marquee-track {
            animation: marquee 45s linear infinite;
          }
          .group:hover .marquee-track,
          .group:focus-within .marquee-track {
            animation-play-state: paused;
          }
          @keyframes marquee {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
      )}
    </section>
  );
}
