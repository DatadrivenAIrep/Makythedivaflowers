// data/wedding-portfolio.ts
export type PortfolioPhoto = {
  id: string;
  src: string;
  alt: { en: string; es: string };
  aspect: "4/5" | "1/1" | "16/9" | "3/4";
};

export const weddingPortfolio: PortfolioPhoto[] = [
  { id: "w1",  src: "https://picsum.photos/seed/diva-w-1/1600/2000",  aspect: "4/5",  alt: { en: "Cascading arch installation, Glen Cove",        es: "Arco de instalación en cascada, Glen Cove" } },
  { id: "w2",  src: "https://picsum.photos/seed/diva-w-2/1600/1600",  aspect: "1/1",  alt: { en: "Bridal bouquet, garden roses + ranunculus",   es: "Ramo de novia, rosas de jardín y ranúnculos" } },
  { id: "w3",  src: "https://picsum.photos/seed/diva-w-3/2400/1350",  aspect: "16/9", alt: { en: "Reception tablescape, low-and-lush centerpieces", es: "Mesa de recepción, centros bajos y abundantes" } },
  { id: "w4",  src: "https://picsum.photos/seed/diva-w-4/1500/2000",  aspect: "3/4",  alt: { en: "Ceremony aisle markers in candlelight",       es: "Marcadores del pasillo a la luz de las velas" } },
  { id: "w5",  src: "https://picsum.photos/seed/diva-w-5/1600/2000",  aspect: "4/5",  alt: { en: "Floral arch with hanging amaranthus",         es: "Arco floral con amaranto colgante" } },
  { id: "w6",  src: "https://picsum.photos/seed/diva-w-6/1600/1600",  aspect: "1/1",  alt: { en: "Boutonnières, soft pinks and ivory",          es: "Boutonnières, rosas suaves y marfil" } },
  { id: "w7",  src: "https://picsum.photos/seed/diva-w-7/2400/1350",  aspect: "16/9", alt: { en: "Cocktail hour florals on bar",                es: "Florales en el bar durante el cóctel" } },
  { id: "w8",  src: "https://picsum.photos/seed/diva-w-8/1500/2000",  aspect: "3/4",  alt: { en: "Hanging floral chandelier over dance floor",  es: "Candelabro floral colgante sobre la pista" } },
  { id: "w9",  src: "https://picsum.photos/seed/diva-w-9/1600/2000",  aspect: "4/5",  alt: { en: "Ceremony backdrop, asymmetric installation",  es: "Fondo de ceremonia, instalación asimétrica" } },
  { id: "w10", src: "https://picsum.photos/seed/diva-w-10/1600/1600", aspect: "1/1",  alt: { en: "Bridesmaid bouquet, mixed greens",            es: "Ramo de dama, verdes mixtos" } },
  { id: "w11", src: "https://picsum.photos/seed/diva-w-11/2400/1350", aspect: "16/9", alt: { en: "Sweetheart table, full-bloom statement",      es: "Mesa de novios, declaración en plena flor" } },
  { id: "w12", src: "https://picsum.photos/seed/diva-w-12/1500/2000", aspect: "3/4",  alt: { en: "Pew arrangement, white peonies",              es: "Arreglo de banco, peonías blancas" } },
];
