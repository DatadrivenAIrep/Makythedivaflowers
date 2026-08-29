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
    id: "quinceanera-saint-brigid",
    kind: "event",
    venue: { en: "Quinceañera · Saint Brigid Church", es: "Quinceañera · Iglesia Saint Brigid" },
    date: { en: "August 29, 2026", es: "29 de agosto de 2026" },
    media: [
      { type: "photo", src: "/events/quinceanera-saint-brigid/p01.webp", alt: { en: "Quinceañera walking the rose-lined church aisle", es: "Quinceañera caminando por el pasillo decorado con rosas" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p02.webp", alt: { en: "Church aisle lined with blush hydrangea and rose arrangements", es: "Pasillo de la iglesia con arreglos de hortensias y rosas rosadas" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p03.webp", alt: { en: "Altar framed by soft pink floral arrangements", es: "Altar enmarcado por arreglos florales rosados" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p04.webp", alt: { en: "Quinceañera in her blush ballgown down the aisle", es: "Quinceañera con su vestido rosa por el pasillo" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p05.webp", alt: { en: "Pew florals and rose petals along the aisle", es: "Flores en las bancas y pétalos de rosa por el pasillo" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p06.webp", alt: { en: "Close view of the blush pew arrangements", es: "Vista cercana de los arreglos rosados en las bancas" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p07.webp", alt: { en: "Quinceañera at the altar during the Mass", es: "Quinceañera en el altar durante la misa" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p08.webp", alt: { en: "Ceremony moment framed by florals", es: "Momento de la ceremonia enmarcado por flores" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p09.webp", alt: { en: "Aisle arrangements with the celebrant", es: "Arreglos del pasillo con el sacerdote" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p10.webp", alt: { en: "Portrait of the quinceañera among the flowers", es: "Retrato de la quinceañera entre las flores" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p11.webp", alt: { en: "Family portrait after the ceremony", es: "Retrato familiar después de la ceremonia" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p12.webp", alt: { en: "Quinceañera bouquet of pink and cream roses", es: "Ramo de quinceañera de rosas rosadas y crema" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p13.webp", alt: { en: "Quinceañera bouquet with blush satin ribbon", es: "Ramo de quinceañera con lazo de satín rosa" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p14.webp", alt: { en: "Rose and baby's breath floral crown", es: "Corona floral de rosas y gypsophila" } },
      { type: "photo", src: "/events/quinceanera-saint-brigid/p15.webp", alt: { en: "Pair of floral crowns for the celebration", es: "Par de coronas florales para la celebración" } },
    ],
  },
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
