export type WeddingEventPhoto = {
  src: string;
  alt: { en: string; es: string };
};

export type WeddingEvent = {
  id: string;
  venue: { en: string; es: string };
  date: { en: string; es: string };
  heroSrc: string;
  heroAlt: { en: string; es: string };
  photos: WeddingEventPhoto[];
};

export const weddingEvents: WeddingEvent[] = [
  {
    id: "dani-bridal-shower-jun-2026",
    venue: { en: "Private Venue", es: "Salón Privado" },
    date:  { en: "June 2, 2026", es: "2 de junio de 2026" },
    heroSrc: "/weddings/dani-bridal-shower-jun-2026/7234.webp",
    heroAlt: {
      en: "Dani's bridal shower floral arrangements by Diva Flowers",
      es: "Arreglos florales del bridal shower de Dani por Diva Flowers",
    },
    photos: [
      { src: "/weddings/dani-bridal-shower-jun-2026/7234.webp", alt: { en: "Floral centerpiece at Dani's bridal shower",       es: "Centro de mesa floral en el bridal shower de Dani" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7236.webp", alt: { en: "Soft floral arrangement in pastel tones",          es: "Arreglo floral suave en tonos pastel" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7238.webp", alt: { en: "Detail of fresh blooms for the celebration",       es: "Detalle de flores frescas para la celebración" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7240a.webp", alt: { en: "Wide view of the bridal shower floral decor",     es: "Vista general de la decoración floral del bridal shower" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7240b.webp", alt: { en: "Elegant floral display at the venue",             es: "Exhibición floral elegante en el salón" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7240c.webp", alt: { en: "Romantic florals by Diva Flowers",                es: "Florales románticos por Diva Flowers" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7243.webp", alt: { en: "Lush bouquet arrangement for the bride-to-be",    es: "Arreglo exuberante para la futura novia" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7244.webp", alt: { en: "Table setting with seasonal blooms",              es: "Mesa decorada con flores de temporada" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7246.webp", alt: { en: "Cascading floral installation detail",            es: "Detalle de instalación floral en cascada" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7247.webp", alt: { en: "Full floral setup at the bridal shower",          es: "Montaje floral completo del bridal shower" } },
      { src: "/weddings/dani-bridal-shower-jun-2026/7248.webp", alt: { en: "Close-up of mixed blooms and greenery",           es: "Primer plano de flores mixtas y follaje" } },
    ],
  },

  // Placeholder events — replace with real photos when available
  {
    id: "westbury-oct-2024",
    venue: { en: "Westbury Manor", es: "Westbury Manor" },
    date:  { en: "October 12, 2024", es: "12 de octubre de 2024" },
    heroSrc: "/weddings/06.webp",
    heroAlt: {
      en: "Cinematic wide view of a Diva wedding install",
      es: "Vista panorámica de una instalación de boda Diva",
    },
    photos: [
      { src: "/weddings/01.webp", alt: { en: "Wedding florals from the Diva studio floor",    es: "Florales de boda desde el estudio de Diva" } },
      { src: "/weddings/02.webp", alt: { en: "Bridal bouquet in soft natural light",          es: "Ramo de novia en luz natural suave" } },
      { src: "/weddings/03.webp", alt: { en: "Reception centerpiece in full bloom",           es: "Centro de mesa de recepción en plena flor" } },
      { src: "/weddings/04.webp", alt: { en: "Detail of garden roses and ranunculus",         es: "Detalle de rosas de jardín y ranúnculos" } },
      { src: "/weddings/05.webp", alt: { en: "Ceremony arrangement, elegant white blooms",    es: "Arreglo de ceremonia, flores blancas elegantes" } },
      { src: "/weddings/06.webp", alt: { en: "Cinematic wide view of a Diva wedding install", es: "Vista panorámica de una instalación de boda Diva" } },
    ],
  },
  {
    id: "garden-city-jun-2024",
    venue: { en: "Garden City Hotel", es: "Garden City Hotel" },
    date:  { en: "June 8, 2024", es: "8 de junio de 2024" },
    heroSrc: "/weddings/12.webp",
    heroAlt: {
      en: "Full-room reception florals, wide view",
      es: "Florales de recepción de salón completo",
    },
    photos: [
      { src: "/weddings/07.webp", alt: { en: "Tablescape with low-and-lush centerpieces",   es: "Mesa con centros bajos y abundantes" } },
      { src: "/weddings/08.webp", alt: { en: "Vertical floral installation detail",          es: "Detalle de instalación floral vertical" } },
      { src: "/weddings/09.webp", alt: { en: "Reception florals at golden hour",             es: "Florales de recepción al atardecer" } },
      { src: "/weddings/10.webp", alt: { en: "Tall arrangement against natural backdrop",    es: "Arreglo alto contra fondo natural" } },
      { src: "/weddings/11.webp", alt: { en: "Soft and romantic floral palette",             es: "Paleta floral suave y romántica" } },
      { src: "/weddings/12.webp", alt: { en: "Full-room reception florals, wide view",       es: "Florales de recepción de salón completo" } },
    ],
  },
  {
    id: "oheka-mar-2024",
    venue: { en: "Oheka Castle", es: "Oheka Castle" },
    date:  { en: "March 22, 2024", es: "22 de marzo de 2024" },
    heroSrc: "/weddings/13.webp",
    heroAlt: {
      en: "Ceremony arch in full bloom",
      es: "Arco de ceremonia en plena flor",
    },
    photos: [
      { src: "/weddings/13.webp", alt: { en: "Ceremony arch in full bloom",                   es: "Arco de ceremonia en plena flor" } },
      { src: "/weddings/14.webp", alt: { en: "Square detail of textured greenery and blooms", es: "Detalle cuadrado de follaje texturado y flores" } },
      { src: "/weddings/15.webp", alt: { en: "Mixed bouquet with seasonal stems",             es: "Ramo mixto con tallos de temporada" } },
      { src: "/weddings/16.webp", alt: { en: "Editorial portrait of a Diva arrangement",      es: "Retrato editorial de un arreglo Diva" } },
      { src: "/weddings/17.webp", alt: { en: "Panoramic view of a Diva wedding setup",        es: "Vista panorámica de un montaje de boda Diva" } },
    ],
  },
];
