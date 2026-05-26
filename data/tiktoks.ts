// data/tiktoks.ts
import type { Localized } from "@/types/product";

export type TikTokVideo = {
  /** Stable identifier; also used as the thumbnail filename. */
  slug: string;
  /** Numeric TikTok video ID — the last path segment of the TikTok URL. */
  videoId: string;
  /** Canonical TikTok URL (used as the outbound "Watch on TikTok" link). */
  url: string;
  thumbnail: {
    /** Path under /public, served at site root. */
    src: string;
    alt: Localized;
  };
  /** Optional display string for the views badge (e.g., "128K"). Free-form, owner-edited. */
  views?: string;
};

export const TIKTOKS: readonly TikTokVideo[] = [
  {
    slug: "viral-1",
    videoId: "7610474236838219021",
    url: "https://www.tiktok.com/@makythediva/video/7610474236838219021",
    thumbnail: {
      src: "/tiktoks/viral-1.webp",
      alt: {
        en: "Behind the studio with Maky — featured video 1",
        es: "Detrás del estudio con Maky — video destacado 1",
      },
    },
  },
  {
    slug: "viral-2",
    videoId: "7156275877272243498",
    url: "https://www.tiktok.com/@makythediva/video/7156275877272243498",
    thumbnail: {
      src: "/tiktoks/viral-2.webp",
      alt: {
        en: "Behind the studio with Maky — featured video 2",
        es: "Detrás del estudio con Maky — video destacado 2",
      },
    },
  },
  {
    slug: "viral-3",
    videoId: "7608688315272809742",
    url: "https://www.tiktok.com/@makythediva/video/7608688315272809742",
    thumbnail: {
      src: "/tiktoks/viral-3.webp",
      alt: {
        en: "Behind the studio with Maky — featured video 3",
        es: "Detrás del estudio con Maky — video destacado 3",
      },
    },
  },
  {
    slug: "viral-4",
    videoId: "7639218503085722893",
    url: "https://www.tiktok.com/@makythediva/video/7639218503085722893",
    thumbnail: {
      src: "/tiktoks/viral-4.webp",
      alt: {
        en: "Behind the studio with Maky — featured video 4",
        es: "Detrás del estudio con Maky — video destacado 4",
      },
    },
  },
];
