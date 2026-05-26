import type { Localized } from "@/types/product";

export type SubscriptionPlanId = "small" | "medium" | "large";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: Localized;
  priceCents: number;
  blurb: Localized;
  highlights: [Localized, Localized, Localized];
  popular?: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "small",
    name: { en: "Small Bouquet", es: "Ramo Small" },
    priceCents: 4500,
    blurb: {
      en: "An intimate hand-tied bouquet, kraft-wrapped — sized for the bedside or kitchen counter.",
      es: "Un ramo íntimo atado a mano y envuelto en kraft — del tamaño justo para la mesita o la cocina.",
    },
    highlights: [
      { en: "Intimate hand-tied wrap", es: "Ramo íntimo atado a mano" },
      { en: "Kraft paper, hand-written card", es: "Papel kraft, tarjeta a mano" },
      { en: "Weekly or bi-weekly · cancel anytime", es: "Semanal o quincenal · cancela cuando quieras" },
    ],
  },
  {
    id: "medium",
    name: { en: "Medium Bouquet", es: "Ramo Medium" },
    priceCents: 8500,
    popular: true,
    blurb: {
      en: "Our most-loved size: a generous wrap with premium seasonal flowers, made for the dining table.",
      es: "Nuestro tamaño más querido: un ramo generoso con flores premium de temporada, pensado para la mesa del comedor.",
    },
    highlights: [
      { en: "Generous wrap, premium varieties", es: "Ramo generoso, variedades premium" },
      { en: "Signed paper, hand-written card", es: "Papel firmado, tarjeta a mano" },
      { en: "Weekly or bi-weekly · cancel anytime", es: "Semanal o quincenal · cancela cuando quieras" },
    ],
  },
  {
    id: "large",
    name: { en: "Large Bouquet", es: "Ramo Large" },
    priceCents: 14500,
    blurb: {
      en: "A statement bouquet with focal blooms — peonies, garden roses, and seasonal rarities, sized for the entryway.",
      es: "Un ramo de presencia con flores focales — peonías, rosas de jardín y rarezas de temporada, del tamaño del recibidor.",
    },
    highlights: [
      { en: "Statement wrap with focal blooms", es: "Ramo de presencia con flores focales" },
      { en: "Signed paper, priority delivery window", es: "Papel firmado, ventana de entrega prioritaria" },
      { en: "Weekly or bi-weekly · cancel anytime", es: "Semanal o quincenal · cancela cuando quieras" },
    ],
  },
];

export function findSubscriptionPlan(id: SubscriptionPlanId): SubscriptionPlan {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown subscription plan: ${id}`);
  return plan;
}
