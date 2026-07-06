// types/portfolio.ts
export type LocalizedText = { en: string; es: string };

export type MediaItem =
  | { type: "photo"; src: string; alt: LocalizedText }
  | { type: "video"; src: string; poster: string; alt: LocalizedText };

export type PortfolioEvent = {
  id: string;
  kind: "wedding" | "event";
  venue: LocalizedText;
  date: LocalizedText; // may be "" until the owner fills it in
  media: MediaItem[]; // media[0] is the hero
};
