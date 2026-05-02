export const CATS = [
  { slug: "arrangements", seed: "cat-arrangements" },
  { slug: "bouquets", seed: "cat-bouquets" },
  { slug: "plants", seed: "cat-plants" },
  { slug: "gifts", seed: "cat-gifts" },
  { slug: "sympathy", seed: "cat-sympathy" },
  { slug: "subscriptions", seed: "cat-subscriptions" },
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
