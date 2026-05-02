"use client";
import { useState } from "react";
import { LayoutGroup } from "framer-motion";
import { useTranslations } from "next-intl";
import { weddingPortfolio, type PortfolioPhoto } from "@/data/wedding-portfolio";
import { GalleryMosaic } from "./GalleryMosaic";
import { GalleryHero } from "./GalleryHero";
import { GalleryMarquee } from "./GalleryMarquee";
import { GalleryLightbox } from "./GalleryLightbox";
import type { Locale } from "@/types/locale";

type Block =
  | { kind: "mosaic"; photos: PortfolioPhoto[]; indices: number[] }
  | { kind: "hero"; photo: PortfolioPhoto; index: number };

function buildBlocks(photos: PortfolioPhoto[]): Block[] {
  const blocks: Block[] = [];
  let bucket: { photos: PortfolioPhoto[]; indices: number[] } = { photos: [], indices: [] };
  photos.forEach((photo, i) => {
    if (photo.layout === "hero") {
      if (bucket.photos.length > 0) {
        blocks.push({ kind: "mosaic", ...bucket });
        bucket = { photos: [], indices: [] };
      }
      blocks.push({ kind: "hero", photo, index: i });
    } else {
      bucket.photos.push(photo);
      bucket.indices.push(i);
    }
  });
  if (bucket.photos.length > 0) blocks.push({ kind: "mosaic", ...bucket });
  return blocks;
}

const BLOCKS = buildBlocks(weddingPortfolio);

export function GalleryEditorial({ locale }: { locale: Locale }) {
  const t = useTranslations("weddings.gallery");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <LayoutGroup>
      <section className="py-24">
        <header className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-5xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <div className="space-y-16 md:space-y-24">
          {BLOCKS.map((block, bi) => {
            if (block.kind === "mosaic") {
              return (
                <GalleryMosaic
                  key={block.photos[0].id}
                  photos={block.photos}
                  indices={block.indices}
                  locale={locale}
                  priorityFirst={bi === 0}
                  onOpen={setActiveIndex}
                />
              );
            }
            return (
              <GalleryHero
                key={block.photo.id}
                photo={block.photo}
                index={block.index}
                locale={locale}
                onOpen={setActiveIndex}
              />
            );
          })}
        </div>
        <div className="mt-16 md:mt-24">
          <GalleryMarquee photos={weddingPortfolio} locale={locale} onOpen={setActiveIndex} />
        </div>
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
