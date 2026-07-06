// data/event-projects.ts
import type { PortfolioEvent } from "@/types/portfolio";

const eventPhoto = (src: string) => ({
  type: "photo" as const, src,
  alt: { en: "Event florals by Diva Flowers", es: "Florales de evento por Diva Flowers" },
});
const eventVideo = (n: string, slug: string) => ({
  type: "video" as const, src: `/events/${slug}/${n}.mp4`, poster: `/events/${slug}/${n}.webp`,
  alt: { en: "Event film by Diva Flowers", es: "Video de evento por Diva Flowers" },
});

export const eventProjects: PortfolioEvent[] = [
  {
    id: "evento-01",
    kind: "event",
    venue: { en: "Private Event", es: "Evento privado" },
    date: { en: "", es: "" },
    media: ["p01","p02","p03","p04","p05","p06","p07","p08","p09"].map((p) => eventPhoto(`/events/evento-01/${p}.webp`)),
  },
  {
    id: "evento-02",
    kind: "event",
    venue: { en: "Private Event", es: "Evento privado" },
    date: { en: "", es: "" },
    media: ["p01","p02","p03","p04","p05","p06","p07","p08"].map((p) => eventPhoto(`/events/evento-02/${p}.webp`)),
  },
  {
    id: "evento-03",
    kind: "event",
    venue: { en: "Private Event", es: "Evento privado" },
    date: { en: "", es: "" },
    media: ["v01","v02","v03","v04"].map((v) => eventVideo(v, "evento-03")),
  },
  {
    id: "comunion-01",
    kind: "event",
    venue: { en: "First Communion", es: "Primera comunión" },
    date: { en: "", es: "" },
    media: [
      { type: "photo", src: "/events/comunion-01/p01.webp", alt: { en: "First-communion florals by Diva Flowers", es: "Florales de primera comunión por Diva Flowers" } },
      { type: "photo", src: "/events/comunion-01/p02.webp", alt: { en: "First-communion florals by Diva Flowers", es: "Florales de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v01.mp4", poster: "/events/comunion-01/v01.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v02.mp4", poster: "/events/comunion-01/v02.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v03.mp4", poster: "/events/comunion-01/v03.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
      { type: "video", src: "/events/comunion-01/v04.mp4", poster: "/events/comunion-01/v04.webp", alt: { en: "First-communion film by Diva Flowers", es: "Video de primera comunión por Diva Flowers" } },
    ],
  },
  {
    id: "bridal-shower-jun-2026",
    kind: "event",
    venue: { en: "Bridal Shower", es: "Bridal Shower" },
    date: { en: "June 2, 2026", es: "2 de junio de 2026" },
    media: [
      { type: "photo", src: "/events/bridal-shower-jun-2026/7247.webp", alt: { en: "Full floral setup at the bridal shower", es: "Montaje floral completo del bridal shower" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7236.webp", alt: { en: "Soft floral arrangement in pastel tones", es: "Arreglo floral suave en tonos pastel" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7238.webp", alt: { en: "Detail of fresh blooms for the celebration", es: "Detalle de flores frescas para la celebración" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7240a.webp", alt: { en: "Wide view of the bridal shower floral decor", es: "Vista general de la decoración floral del bridal shower" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7240b.webp", alt: { en: "Elegant floral display at the venue", es: "Exhibición floral elegante en el salón" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7240c.webp", alt: { en: "Romantic florals by Diva Flowers", es: "Florales románticos por Diva Flowers" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7243.webp", alt: { en: "Lush bouquet arrangement for the bride-to-be", es: "Arreglo exuberante para la futura novia" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7244.webp", alt: { en: "Table setting with seasonal blooms", es: "Mesa decorada con flores de temporada" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7246.webp", alt: { en: "Cascading floral installation detail", es: "Detalle de instalación floral en cascada" } },
      { type: "photo", src: "/events/bridal-shower-jun-2026/7248.webp", alt: { en: "Close-up of mixed blooms and greenery", es: "Primer plano de flores mixtas y follaje" } },
    ],
  },
];
