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

export const TIKTOKS: readonly TikTokVideo[] = [];
