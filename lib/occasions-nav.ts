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
  /** Real catalog photo of a piece tagged with this occasion. */
  img: string;
  /** Sympathy has a dedicated page; the rest deep-link into the filtered shop. */
  path: (locale: string) => string;
};

export const OCCASION_NAV: OccasionNavItem[] = [
  {
    slug: "birthday",
    label: { en: "Birthday", es: "Cumpleaños" },
    img: "/products/cottage-garden-charm.jpg",
    path: (l) => `/${l}/ocasiones/birthday`,
  },
  {
    slug: "romance",
    label: { en: "Love & Romance", es: "Amor y Romance" },
    img: "/products/a-thousand-heartbeats.jpg",
    path: (l) => `/${l}/ocasiones/romance`,
  },
  {
    slug: "anniversary",
    label: { en: "Anniversary", es: "Aniversario" },
    img: "/products/hundred-roses-vase.png",
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
    img: "/products/abundant-table.jpg",
    path: (l) => `/${l}/ocasiones/congrats`,
  },
  {
    slug: "get-well",
    label: { en: "Get well", es: "Mejórate pronto" },
    img: "/products/phalaenopsis-white-single.webp",
    path: (l) => `/${l}/ocasiones/get-well`,
  },
  {
    slug: "graduation",
    label: { en: "Graduation", es: "Graduación" },
    img: "/products/botanic-fireworks.jpg",
    path: (l) => `/${l}/ocasiones/graduation`,
  },
  {
    slug: "new-baby",
    label: { en: "New baby", es: "Recién nacido" },
    img: "/products/butterfly-kiss.jpg",
    path: (l) => `/${l}/ocasiones/new-baby`,
  },
  {
    slug: "thank-you",
    label: { en: "Thank you", es: "Gracias" },
    img: "/products/abundant-table.jpg",
    path: (l) => `/${l}/ocasiones/thank-you`,
  },
  {
    slug: "thinking-of-you",
    label: { en: "Thinking of you", es: "Pienso en ti" },
    img: "/products/jade-lavender.jpg",
    path: (l) => `/${l}/ocasiones/thinking-of-you`,
  },
  {
    slug: "just-because",
    label: { en: "Just because", es: "Sin razón" },
    img: "/products/rainforest-rhapsody.jpg",
    path: (l) => `/${l}/ocasiones/just-because`,
  },
];
