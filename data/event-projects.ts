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
];
