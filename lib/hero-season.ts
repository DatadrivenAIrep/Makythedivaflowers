// lib/hero-season.ts
// Which hero the home page shows today. Seasons are date windows in the
// shop's timezone; outside every window the home falls back to Maky's
// signature video, so a season never has to be switched off by hand.
import { shopDateStr } from "@/lib/tv-slots";

export type HeroSeasonKey = "default" | "fall";

export type HeroSeason = {
  key: HeroSeasonKey;
  video: string;
  poster: string;
  /** next-intl namespace holding title/sub (and eyebrow, when seasonal). */
  copyNamespace: "home.hero" | "home.hero_fall";
  /** Radial wash from the top-right corner over the video. */
  accent: string;
  /** CSS object-position: keeps the subject in frame on narrow screens. */
  focus: string;
  /** "right": the subject owns the right half, so the copy moves left over a scrim. */
  subject: "behind" | "right";
};

const DEFAULT_HERO: HeroSeason = {
  key: "default",
  video: "/hero/divavideo.mp4",
  poster: "/hero/divavideo-poster.jpg",
  copyNamespace: "home.hero",
  accent: "rgba(184,52,94,0.22)",
  focus: "50% 50%",
  subject: "behind",
};

const FALL_HERO: HeroSeason = {
  key: "fall",
  video: "/hero/fall.mp4",
  poster: "/hero/fall-poster.jpg",
  copyNamespace: "home.hero_fall",
  accent: "rgba(196,98,45,0.20)",
  // The arrangement sits on the right third of the frame.
  focus: "72% 50%",
  subject: "right",
};

/** US Thanksgiving: the fourth Thursday of November, as "YYYY-MM-DD". */
export function thanksgiving(year: number): string {
  const nov1 = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0 = Sunday
  const firstThursday = 1 + ((4 - nov1 + 7) % 7);
  return `${year}-11-${String(firstThursday + 21).padStart(2, "0")}`;
}

export function heroSeason(now: Date = new Date()): HeroSeason {
  const today = shopDateStr(now); // YYYY-MM-DD, sortable as a string
  const year = today.slice(0, 4);
  if (today >= `${year}-09-15` && today <= thanksgiving(Number(year))) return FALL_HERO;
  return DEFAULT_HERO;
}
