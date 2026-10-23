// data/digital-cards.ts
//
// Copy for the /digital-cards page: what a digital card is, how ordering one
// works, and every design on the card platform, each linked to its live demo.
// Every claim here is something the cards really do — they are recorded in the
// promo film from the live demos.
import { DEMOS_URL } from "@/lib/digital-card-offer";
import type { Locale } from "@/types/locale";

type L = { en: string; es: string };

export type DigitalCardModel = {
  /** The card platform's template id; also the thumbnail's file name. */
  id: string;
  name: L;
  occasion: L;
};

/** The designs, in the order the promo film shows them. */
export const DIGITAL_CARD_MODELS: DigitalCardModel[] = [
  { id: "velvet-rose", name: { en: "Velvet Rose", es: "Rosa de terciopelo" }, occasion: { en: "Love · Anniversaries", es: "Amor · Aniversarios" } },
  { id: "gilded-noir", name: { en: "Gilded Noir", es: "Negro y oro" }, occasion: { en: "Birthdays · Milestones", es: "Cumpleaños · Fechas especiales" } },
  { id: "quince-butterflies", name: { en: "Metamorphosis", es: "Metamorfosis" }, occasion: { en: "Quinceañeras", es: "Quinceañeras · XV años" } },
  { id: "harvest-candle", name: { en: "Harvest Candle", es: "Vela de cosecha" }, occasion: { en: "Thanksgiving · Gratitude", es: "Acción de Gracias · Gratitud" } },
  { id: "envelope-seal", name: { en: "Envelope & Seal", es: "Sobre y lacre" }, occasion: { en: "Weddings", es: "Bodas" } },
  { id: "velvet-theatre", name: { en: "Velvet Theatre", es: "Teatro de terciopelo" }, occasion: { en: "Weddings", es: "Bodas" } },
  { id: "blooming-garden", name: { en: "Blooming Garden", es: "Jardín que florece" }, occasion: { en: "Weddings", es: "Bodas" } },
];

/** A design's live demo, in the visitor's language where the demo has one. */
export function demoUrl(id: string, locale: Locale): string {
  // The birthday demo is written in English only.
  if (locale === "es" || id === "gilded-noir") return `${DEMOS_URL}/demo/${id}`;
  return `${DEMOS_URL}/i/demo-${id}?lang=en`;
}

export const DIGITAL_CARDS_PAGE = {
  meta: {
    title: { en: "Digital cards | Diva Flowers", es: "Tarjetas digitales | Diva Flowers" },
    description: {
      en: "Add an animated digital card to any bouquet: they scan the QR in the card and it opens on their phone, with their names, your letter and your photos.",
      es: "Añade una tarjeta digital animada a cualquier ramo: escanean el QR de la tarjeta y se abre en su teléfono, con sus nombres, tu carta y tus fotos.",
    },
  },
  eyebrow: { en: "New · Digital cards", es: "Nuevo · Tarjetas digitales" },
  title: { en: ["Say it with flowers.", "Then say more."], es: ["Dilo con flores.", "Y di aún más."] },
  lead: {
    en: "A card made for them travels inside your bouquet. They scan its QR with their phone camera and it comes alive: their names, your letter, your photos.",
    es: "Una tarjeta hecha para quien la recibe viaja dentro de tu ramo. Escanean su QR con la cámara del teléfono y cobra vida: sus nombres, tu carta, tus fotos.",
  },
  price: { en: "+$25 on any bouquet", es: "+$25 en cualquier ramo" },
  ctaShop: { en: "Choose a bouquet", es: "Elegir un ramo" },
  ctaDemos: { en: "See the demos", es: "Ver las demos" },
  filmLabel: { en: "The digital card, in 30 seconds (with sound)", es: "La tarjeta digital en 30 segundos (con sonido)" },
  filmCaption: { en: "30 s · tap to play with sound", es: "30 s · toca para verlo con sonido" },
  stepsTitle: { en: "How it works", es: "Cómo funciona" },
  steps: [
    {
      title: { en: "Add it to your bouquet", es: "Añádela a tu ramo" },
      body: {
        en: "It sits under the card message on every bouquet: one tap, $25.",
        es: "Está bajo el mensaje de la tarjeta en cada ramo: un toque, $25.",
      },
    },
    {
      title: { en: "We make it for them", es: "La creamos para quien la recibe" },
      body: {
        en: "After your order we write to you for their names, your message and, if you like, photos.",
        es: "Después de tu pedido te escribimos para pedirte sus nombres, tu mensaje y, si quieres, fotos.",
      },
    },
    {
      title: { en: "They scan, and it opens", es: "Escanean y se abre" },
      body: {
        en: "The printed card that travels with the flowers carries the QR. Their phone's camera opens the card.",
        es: "La tarjeta impresa que viaja con las flores lleva el QR. La cámara de su teléfono abre la tarjeta.",
      },
    },
  ],
  modelsTitle: { en: "One for every occasion", es: "Una para cada ocasión" },
  modelsLead: {
    en: "Open any of them the way they will: each is a live demo.",
    es: "Ábrelas como lo harán ellos: cada una es una demo en vivo.",
  },
  demoLink: { en: "See the demo", es: "Ver la demo" },
  includedTitle: { en: "In every card", es: "En cada tarjeta" },
  included: [
    { en: "Their names and their story", es: "Sus nombres y su historia" },
    { en: "Your letter", es: "Tu carta" },
    { en: "Your photos", es: "Tus fotos" },
    { en: "Music", es: "Música" },
    { en: "English and Spanish", es: "Español e inglés" },
    { en: "A QR of its own, printed in the card", es: "Un QR propio, impreso en la tarjeta" },
  ],
  faqTitle: { en: "Questions", es: "Preguntas" },
  faq: [
    {
      q: { en: "Do they need an app?", es: "¿Necesitan una app?" },
      a: { en: "No. The phone's camera reads the QR and the card opens in the browser.", es: "No. La cámara del teléfono lee el QR y la tarjeta se abre en el navegador." },
    },
    {
      q: { en: "How do I personalize it?", es: "¿Cómo la personalizo?" },
      a: {
        en: "After your order we write to you for their names, your message and, if you like, photos. We build the card with them.",
        es: "Después de tu pedido te escribimos para pedirte sus nombres, tu mensaje y, si quieres, fotos. Con eso creamos la tarjeta.",
      },
    },
    {
      q: { en: "In which language?", es: "¿En qué idioma?" },
      a: { en: "English, Spanish, or both.", es: "En español, en inglés o en los dos." },
    },
    {
      q: { en: "How much is it?", es: "¿Cuánto cuesta?" },
      a: { en: "$25, added to any bouquet.", es: "$25, añadida a cualquier ramo." },
    },
  ],
  closingTitle: { en: "Add it to your next bouquet.", es: "Agrégala a tu próximo ramo." },
} as const;
