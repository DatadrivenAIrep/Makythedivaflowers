import type { Localized } from "@/types/product";

export type OrchidCareStep = {
  id: "water" | "light" | "after-bloom" | "never";
  title: Localized;
  body: Localized;
};

export const ORCHID_CARE: readonly OrchidCareStep[] = [
  {
    id: "water",
    title: { en: "Water once a week", es: "Riega una vez por semana" },
    body: {
      en: "Three ice-cube-sized splashes of room-temperature water at the roots, or run it under the tap for fifteen seconds and let it drain all the way through. Once a week. That's it.",
      es: "Tres chorritos de agua a temperatura ambiente en las raíces —del tamaño de un cubito de hielo cada uno—, o pásala por el grifo quince segundos y deja que escurra por completo. Una vez por semana. Ya.",
    },
  },
  {
    id: "light",
    title: { en: "Bright, never direct", es: "Luz clara, nunca directa" },
    body: {
      en: "A few feet back from an east or north window is perfect. If the leaves go dark green it wants more light; if they go yellow-ish and leathery, it's getting too much.",
      es: "A un metro de una ventana al este o al norte está perfecto. Si las hojas se ponen verde oscuro quiere más luz; si se ponen amarillentas y correosas, le está dando de más.",
    },
  },
  {
    id: "after-bloom",
    title: { en: "When the flowers drop", es: "Cuando caen las flores" },
    body: {
      en: "The plant isn't dead — it's resting. Cut the spike about an inch above the second node from the bottom, keep watering, and most plants push a new spike within a few months.",
      es: "La planta no se murió — está descansando. Corta la vara unos dos centímetros arriba del segundo nudo desde abajo, sigue regando, y la mayoría saca vara nueva en pocos meses.",
    },
  },
  {
    id: "never",
    title: { en: "Never let it sit in water", es: "Nunca la dejes parada en agua" },
    body: {
      en: "This is the one that kills them. Standing water in the saucer or the cachepot rots the roots in about two weeks. Drain it every single time. And skip the ice cubes — cold shocks tropical roots.",
      es: "Esta es la que las mata. El agua estancada en el plato o en el cachepot pudre las raíces en unas dos semanas. Escúrrela siempre. Y olvida los cubos de hielo — el frío daña las raíces tropicales.",
    },
  },
];
