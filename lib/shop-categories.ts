export const CATS = [
  { slug: "arrangements", img: "/products/flamingo-garden.jpg" },
  { slug: "bouquets", img: "/products/dozen-roses-bouquet.jpg" },
  { slug: "plants", img: "/products/monstera-mood.jpg" },
  { slug: "gifts", img: "/products/daydream-parcel.jpg" },
  { slug: "sympathy", img: "/products/celestial-peace.jpg" },
  { slug: "subscriptions", img: "/products/timeless-romance.jpg" },
] as const;

export type CatSlug = (typeof CATS)[number]["slug"];

export const LABELS: Record<CatSlug, { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  plants: { en: "Plants & Orchids", es: "Plantas y Orquídeas" },
  gifts: { en: "Gifts", es: "Regalos" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
};
