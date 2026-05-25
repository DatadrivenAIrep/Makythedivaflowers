"use client";
import { useState } from "react";
import type { Locale } from "@/types/locale";
import type { TikTokVideo } from "@/data/tiktoks";
import { TikTokLightbox } from "./TikTokLightbox";

export function TikTokCard({
  video,
  locale,
}: {
  video: TikTokVideo;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={video.thumbnail.alt[locale]}
        className="group relative block w-full aspect-[9/16] rounded-xl overflow-hidden bg-ink/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
      >
        <img
          src={video.thumbnail.src}
          alt={video.thumbnail.alt[locale]}
          className="absolute inset-0 size-full object-cover transition-opacity group-hover:opacity-90"
          loading="lazy"
        />

        {/* Play icon */}
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-12 rounded-full bg-bone/95 text-ink flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition group-hover:scale-105"
        >
          <span className="block w-0 h-0 border-y-[8px] border-y-transparent border-l-[12px] border-l-ink ml-[3px]" />
        </span>

        {/* Views badge (optional) */}
        {video.views ? (
          <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-ink/55 text-bone backdrop-blur-sm font-mono text-[10px] tracking-[0.05em]">
            {video.views}
          </span>
        ) : null}
      </button>

      <TikTokLightbox
        videoId={video.videoId}
        url={video.url}
        open={open}
        onOpenChange={setOpen}
        locale={locale}
      />
    </>
  );
}
