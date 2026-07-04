// data/wedding-faq.ts
export type FAQ = {
  id: string;
  q: { en: string; es: string };
  a: { en: string; es: string };
};

export const weddingFAQ: FAQ[] = [
  {
    id: "lead-time",
    q: { en: "How far in advance should we book?", es: "¿Con cuánta anticipación debemos reservar?" },
    a: { en: "We typically book installations 8–12 months in advance for peak season (May–October). Off-season weddings can sometimes be accommodated on shorter notice — start with an inquiry and we'll let you know.", es: "Normalmente reservamos instalaciones con 8 a 12 meses de antelación en temporada alta (mayo a octubre). Las bodas fuera de temporada a veces pueden agendarse con menos tiempo — comienza con una consulta y te avisamos." },
  },
  {
    id: "minimum",
    q: { en: "Is there a minimum spend?", es: "¿Hay un mínimo de inversión?" },
    a: {
      en: "We work to a studio minimum that we share during your consultation, scaled to your guest count and the scope of your day.",
      es: "Trabajamos con un mínimo de estudio que compartimos durante tu consulta, ajustado a tu número de invitados y al alcance de tu día.",
    },
  },
  {
    id: "site-visit",
    q: { en: "Do you do site visits?", es: "¿Hacen visitas al lugar?" },
    a: { en: "Yes — once we've aligned on direction, we'll visit the venue together (or virtually if it's far) to plan installs against the actual room.", es: "Sí — una vez alineados en la dirección, visitamos juntos el lugar (o de forma virtual si está lejos) para planificar las instalaciones según el espacio real." },
  },
  {
    id: "delivery-area",
    q: { en: "Where do you deliver?", es: "¿A dónde entregan?" },
    a: { en: "We install across Long Island and the New York metro area. Outside that, we travel by request — there's a travel + lodging line on the proposal.", es: "Instalamos en Long Island y el área metropolitana de Nueva York. Fuera de esa zona, viajamos bajo pedido — la propuesta incluye una línea de viaje y alojamiento." },
  },
  {
    id: "rentals",
    q: { en: "Do you provide vases and rentals?", es: "¿Proveen jarrones y rentas?" },
    a: { en: "We work with a curated set of vessels and rental partners; everything is itemized on your proposal so you know what's purchased vs. rented.", es: "Trabajamos con jarrones curados y socios de renta; todo se desglosa en tu propuesta para que sepas qué se compra y qué se renta." },
  },
  {
    id: "changes",
    q: { en: "What if our vision changes?", es: "¿Qué pasa si nuestra visión cambia?" },
    a: { en: "We expect it. The proposal is iterative — we lock the final scope ~30 days before the date and adjust as needed within budget.", es: "Lo esperamos. La propuesta es iterativa — fijamos el alcance final ~30 días antes de la fecha y ajustamos según sea necesario dentro del presupuesto." },
  },
];
