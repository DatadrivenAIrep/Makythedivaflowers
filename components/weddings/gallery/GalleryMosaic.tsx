"use client";
import { GalleryTile } from "./GalleryTile";
import type { PortfolioPhoto } from "@/data/wedding-portfolio";
import type { Locale } from "@/types/locale";

type Props = {
  photos: PortfolioPhoto[];
  indices: number[];
  locale: Locale;
  priorityFirst?: boolean;
  onOpen: (index: number) => void;
};

export function GalleryMosaic({ photos, indices, locale, priorityFirst = false, onOpen }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo, i) => (
          <GalleryTile
            key={photo.id}
            photo={photo}
            locale={locale}
            index={indices[i]}
            showIndex
            priority={priorityFirst && i === 0}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}
