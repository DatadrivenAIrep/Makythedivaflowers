// lib/occasions-nav.ts
//
// The shopper-facing occasion list, shared by the home strip, the desktop mega
// menu and the mobile drawer — the way `lib/shop-categories.ts` is shared by the
// category surfaces. Competitors (Flowers by Mike, QG Floral, Tizarah, Creations
// de Belle) all lead with occasion, not product type; this is the single source
// for that navigation so the three surfaces can never drift apart.
//
// `path` is a function of the locale because sympathy keeps its own landing page
// while every other occasion has one under /ocasiones/[slug]. Those pages carry
// the guidance and FAQ; the filtered shop is one click further in.
import type { Occasion } from "@/types/product";

export type OccasionNavItem = {
  /** Matches the `Occasion` union so the shop filter round-trips. */
  slug: Occasion;
  label: { en: string; es: string };
  /**
   * Cover photo of an active piece tagged with this occasion (a test checks it),
   * so the card never shows, say, a sympathy orchid for "get well".
   */
  img: string;
  /** Sympathy has a dedicated page; the rest deep-link into the filtered shop. */
  path: (locale: string) => string;
};

export const OCCASION_NAV: OccasionNavItem[] = [
  {
    slug: "birthday",
    label: { en: "Birthday", es: "Cumpleaños" },
    img: "/products/birthday-queen.jpg",
    path: (l) => `/${l}/ocasiones/birthday`,
  },
  {
    slug: "romance",
    label: { en: "Love & Romance", es: "Amor y Romance" },
    img: "/products/magenta-majesty.jpg",
    path: (l) => `/${l}/ocasiones/romance`,
  },
  {
    slug: "anniversary",
    label: { en: "Anniversary", es: "Aniversario" },
    img: "/products/rose-quartz.jpg",
    path: (l) => `/${l}/ocasiones/anniversary`,
  },
  {
    slug: "sympathy",
    label: { en: "Sympathy", es: "Condolencias" },
    img: "/products/celestial-peace.jpg",
    path: (l) => `/${l}/sympathy`,
  },
  {
    slug: "congrats",
    label: { en: "Congratulations", es: "Felicitaciones" },
    img: "/products/vibrant-vibes.jpg",
    path: (l) => `/${l}/ocasiones/congrats`,
  },
  {
    slug: "get-well",
    label: { en: "Get well", es: "Mejórate pronto" },
    img: "/products/sunshine-basket.jpg",
    path: (l) => `/${l}/ocasiones/get-well`,
  },
  {
    slug: "graduation",
    label: { en: "Graduation", es: "Graduación" },
    img: "/products/springbling.jpg",
    path: (l) => `/${l}/ocasiones/graduation`,
  },
  {
    slug: "new-baby",
    label: { en: "New baby", es: "Recién nacido" },
    img: "/products/baby-blue-teddy.jpg",
    path: (l) => `/${l}/ocasiones/new-baby`,
  },
  {
    slug: "thank-you",
    label: { en: "Thank you", es: "Gracias" },
    img: "/products/summer-confetti.jpg",
    path: (l) => `/${l}/ocasiones/thank-you`,
  },
  {
    slug: "thinking-of-you",
    label: { en: "Thinking of you", es: "Pienso en ti" },
    img: "/products/amethyst-snowdrop.jpg",
    path: (l) => `/${l}/ocasiones/thinking-of-you`,
  },
  {
    slug: "just-because",
    label: { en: "Just because", es: "Sin razón" },
    img: "/products/aloha-aura.jpg",
    path: (l) => `/${l}/ocasiones/just-because`,
  },
];

/** A link in the occasion lists. Like an occasion entry, but its slug is free. */
export type OccasionLink = Omit<OccasionNavItem, "slug"> & { slug: string };

/**
 * Exotic is not an occasion (no occasion page, no filter value), but shoppers
 * reach for the tropical pieces the same way, so every occasion list ends with
 * a link to the exotic collection.
 */
export const EXOTIC_LINK: OccasionLink = {
  slug: "exotic",
  label: { en: "Exotic Flowers", es: "Flores Exóticas" },
  img: "/products/paradise-found.jpg",
  path: (l) => `/${l}/shop/exotic`,
};

/** What the home strip, the mega menu and the mobile drawer list. */
export const OCCASION_LINKS: OccasionLink[] = [...OCCASION_NAV, EXOTIC_LINK];
