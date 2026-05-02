// data/wedding-portfolio.ts
export type PortfolioPhoto = {
  id: string;
  src: string;
  alt: { en: string; es: string };
  aspect: "4/5" | "1/1" | "16/9" | "3/4" | "4/3";
  layout: "mosaic" | "hero";
};

// Source-to-renamed mapping (recorded for traceability):
//   01.webp ← 1.webp                 02.webp ← 3 (1).webp
//   03.webp ← 5 (2).webp             04.webp ← 12 (1).webp
//   05.webp ← 7 (1).webp             06.webp ← oh1-scaled.webp  [hero 1]
//   07.webp ← 6 (1).webp             08.webp ← 4.jpg (converted to webp)
//   09.webp ← 8 (1).webp             10.webp ← 11 (1).webp
//   11.webp ← 2.webp                 12.webp ← 9 (1).webp       [hero 2]
//   13.webp ← 10 (1).webp            14.webp ← oh2.webp
//   15.webp ← per15.webp             16.webp ← per19.webp
//   17.webp ← per18.webp

export const weddingPortfolio: PortfolioPhoto[] = [
  { id: "w01", src: "/weddings/01.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Wedding florals from the Diva studio floor",    es: "Florales de boda desde el estudio de Diva" } },
  { id: "w02", src: "/weddings/02.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Bridal bouquet in soft natural light",          es: "Ramo de novia en luz natural suave" } },
  { id: "w03", src: "/weddings/03.webp", aspect: "4/3",  layout: "mosaic", alt: { en: "Reception centerpiece in full bloom",           es: "Centro de mesa de recepción en plena flor" } },
  { id: "w04", src: "/weddings/04.webp", aspect: "1/1",  layout: "mosaic", alt: { en: "Detail of garden roses and ranunculus",         es: "Detalle de rosas de jardín y ranúnculos" } },
  { id: "w05", src: "/weddings/05.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Ceremony arrangement, elegant white blooms",    es: "Arreglo de ceremonia, flores blancas elegantes" } },
  { id: "w06", src: "/weddings/06.webp", aspect: "16/9", layout: "hero",   alt: { en: "Cinematic wide view of a Diva wedding install", es: "Vista panorámica de una instalación de boda Diva" } },
  { id: "w07", src: "/weddings/07.webp", aspect: "4/3",  layout: "mosaic", alt: { en: "Tablescape with low-and-lush centerpieces",     es: "Mesa con centros bajos y abundantes" } },
  { id: "w08", src: "/weddings/08.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Vertical floral installation detail",           es: "Detalle de instalación floral vertical" } },
  { id: "w09", src: "/weddings/09.webp", aspect: "4/3",  layout: "mosaic", alt: { en: "Reception florals at golden hour",              es: "Florales de recepción al atardecer" } },
  { id: "w10", src: "/weddings/10.webp", aspect: "3/4",  layout: "mosaic", alt: { en: "Tall arrangement against natural backdrop",     es: "Arreglo alto contra fondo natural" } },
  { id: "w11", src: "/weddings/11.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Soft and romantic floral palette",              es: "Paleta floral suave y romántica" } },
  { id: "w12", src: "/weddings/12.webp", aspect: "4/3",  layout: "hero",   alt: { en: "Full-room reception florals, wide view",        es: "Florales de recepción de salón completo" } },
  { id: "w13", src: "/weddings/13.webp", aspect: "4/3",  layout: "mosaic", alt: { en: "Ceremony arch in full bloom",                   es: "Arco de ceremonia en plena flor" } },
  { id: "w14", src: "/weddings/14.webp", aspect: "1/1",  layout: "mosaic", alt: { en: "Square detail of textured greenery and blooms", es: "Detalle cuadrado de follaje texturado y flores" } },
  { id: "w15", src: "/weddings/15.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Mixed bouquet with seasonal stems",             es: "Ramo mixto con tallos de temporada" } },
  { id: "w16", src: "/weddings/16.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Editorial portrait of a Diva arrangement",      es: "Retrato editorial de un arreglo Diva" } },
  { id: "w17", src: "/weddings/17.webp", aspect: "16/9", layout: "mosaic", alt: { en: "Panoramic view of a Diva wedding setup",        es: "Vista panorámica de un montaje de boda Diva" } },
];
