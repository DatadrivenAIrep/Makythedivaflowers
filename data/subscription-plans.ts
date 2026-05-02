import type { Localized } from "@/types/product";

export type SubscriptionPlanId = "petit" | "maison" | "atelier";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: Localized;
  priceCents: number;
  blurb: Localized;
  stems?: number;
  highlights: [Localized, Localized, Localized];
  popular?: boolean;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "petit",
    name: { en: "Petit Bouquet", es: "Petit Bouquet" },
    priceCents: 4500,
    stems: 15,
    blurb: {
      en: "A hand-tied bouquet of about fifteen seasonal stems, wrapped in kraft and signed by the studio.",
      es: "Un ramo atado a mano con unos quince tallos de temporada, envuelto en kraft y firmado por el estudio.",
    },
    highlights: [
      { en: "~15 seasonal stems, hand-tied", es: "~15 tallos de temporada, atados a mano" },
      { en: "Kraft wrap, hand-written card", es: "Envoltura kraft, tarjeta a mano" },
      { en: "Cancel anytime", es: "Cancela cuando quieras" },
    ],
  },
  {
    id: "maison",
    name: { en: "Maison", es: "Maison" },
    priceCents: 8500,
    stems: 25,
    popular: true,
    blurb: {
      en: "Our most-loved plan: a generous bouquet of about twenty-five stems with premium seasonal flowers.",
      es: "Nuestro plan más querido: un ramo generoso de unos veinticinco tallos con flores premium de temporada.",
    },
    highlights: [
      { en: "~25 stems incl. premium varieties", es: "~25 tallos con variedades premium" },
      { en: "Signed paper, hand-written card", es: "Papel firmado, tarjeta a mano" },
      { en: "Cancel anytime", es: "Cancela cuando quieras" },
    ],
  },
  {
    id: "atelier",
    name: { en: "Atelier", es: "Atelier" },
    priceCents: 14500,
    blurb: {
      en: "A vase arrangement of rare seasonal flowers, with a studio vase rotated in every fourth delivery.",
      es: "Un arreglo en jarrón con flores raras de temporada y un jarrón del estudio cada cuatro entregas.",
    },
    highlights: [
      { en: "Vase arrangement, rare seasonal", es: "Arreglo en jarrón, raras de temporada" },
      { en: "Studio vase every 4th delivery", es: "Jarrón del estudio cada 4 entregas" },
      { en: "Priority delivery window", es: "Ventana de entrega prioritaria" },
    ],
  },
];

export function findSubscriptionPlan(id: SubscriptionPlanId): SubscriptionPlan {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown subscription plan: ${id}`);
  return plan;
}
