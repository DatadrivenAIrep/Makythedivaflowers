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

// Placeholder data — replace heroSrc/photos with real paths once event photos
// are imported to public/weddings/{event-id}/
export const weddingEvents: WeddingEvent[] = [
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
