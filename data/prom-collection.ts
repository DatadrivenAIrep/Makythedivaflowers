// data/prom-collection.ts
import type { Localized } from "@/types/product";

export type PromPieceId =
  | "rose-corsage"
  | "rose-boutonniere"
  | "orchid-corsage"
  | "orchid-boutonniere";

export type PromPiece = {
  id: PromPieceId;
  flower: "rose" | "orchid";
  type: "corsage" | "boutonniere";
  priceUSD: number;
  name: Localized;
  description: Localized;
  image: {
    src: string;
    alt: Localized;
  };
};

export const PROM_PIECES: readonly PromPiece[] = [
  {
    id: "rose-corsage",
    flower: "rose",
    type: "corsage",
    priceUSD: 35,
    name: { en: "Rose corsage", es: "Corsage de rosa" },
    description: {
      en: "Three garden roses on the wrist, soft and steady. Pairs with any dress color.",
      es: "Tres rosas de jardín en la muñeca, suaves y seguras. Combina con cualquier color de vestido.",
    },
    image: {
      src: "/prom/rose-corsage.webp",
      alt: {
        en: "Rose wrist corsage with garden roses and ribbon",
        es: "Corsage de muñeca con rosas de jardín y cinta",
      },
    },
  },
  {
    id: "rose-boutonniere",
    flower: "rose",
    type: "boutonniere",
    priceUSD: 15,
    name: { en: "Rose boutonnière", es: "Boutonnière de rosa" },
    description: {
      en: "A single rose on the lapel — clean, classic, easy to match.",
      es: "Una rosa en la solapa — limpia, clásica, fácil de combinar.",
    },
    image: {
      src: "/prom/rose-boutonniere.webp",
      alt: {
        en: "Single-rose boutonnière for prom lapel",
        es: "Boutonnière de una rosa para solapa de prom",
      },
    },
  },
  {
    id: "orchid-corsage",
    flower: "orchid",
    type: "corsage",
    priceUSD: 45,
    name: { en: "Orchid corsage", es: "Corsage de orquídea" },
    description: {
      en: "Cymbidium with satin ribbon. The premium pick for statement-night looks.",
      es: "Cymbidium con cinta de satén. La pieza premium para una noche que se nota.",
    },
    image: {
      src: "/prom/orchid-corsage.webp",
      alt: {
        en: "Cymbidium orchid wrist corsage with satin ribbon",
        es: "Corsage de muñeca con orquídea cymbidium y cinta de satén",
      },
    },
  },
  {
    id: "orchid-boutonniere",
    flower: "orchid",
    type: "boutonniere",
    priceUSD: 25,
    name: { en: "Orchid boutonnière", es: "Boutonnière de orquídea" },
    description: {
      en: "One orchid head, anchored with greenery. Quietly luxe.",
      es: "Una flor de orquídea con un toque de verde. Lujo discreto.",
    },
    image: {
      src: "/prom/orchid-boutonniere.webp",
      alt: {
        en: "Single-orchid boutonnière for prom lapel",
        es: "Boutonnière de una orquídea para solapa de prom",
      },
    },
  },
];

export const FLOWER_GRADIENT: Record<PromPiece["flower"], string> = {
  rose: "bg-gradient-to-br from-[#e89aa6] to-[#c45f72]",
  orchid: "bg-gradient-to-br from-[#b4a4d4] to-[#6e5b9c]",
};
