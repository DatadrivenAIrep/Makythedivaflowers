import type { Localized } from "@/types/product";

export type SympathyForm =
  | "standing-spray"
  | "easel-piece"
  | "casket-spray"
  | "installation";

export type SympathyPiece = {
  slug: string;
  title: Localized;
  form: SympathyForm;
  blurb: Localized;
  image: string;
};

export const SYMPATHY_FORMS: Record<SympathyForm, Localized> = {
  "standing-spray": { en: "Standing spray", es: "Tributo de pie" },
  "easel-piece": { en: "Easel tribute", es: "Tributo en caballete" },
  "casket-spray": { en: "Casket spray", es: "Manto fúnebre" },
  installation: { en: "Custom installation", es: "Instalación a medida" },
};

export const SYMPATHY_PIECES: SympathyPiece[] = [
  {
    slug: "beloved-heart",
    title: { en: "Beloved Heart", es: "Corazón Amado" },
    form: "easel-piece",
    blurb: {
      en: "White hydrangea heart with a diagonal cascade of deep-red garden roses and personalized ribbon.",
      es: "Corazón de hortensias blancas con cascada diagonal de rosas rojas de jardín y cinta personalizada.",
    },
    image: "/sympathy/beloved-heart.jpg",
  },
  {
    slug: "personal-tribute",
    title: { en: "Personal Tribute", es: "Tributo Personalizado" },
    form: "easel-piece",
    blurb: {
      en: "Tall blue-and-white standing tribute with hand-lettered sashes — for the goodbye that needs the name spoken aloud.",
      es: "Tributo alto en azul y blanco con bandas rotuladas a mano — para el adiós que necesita pronunciar el nombre.",
    },
    image: "/sympathy/personal-tribute.jpg",
  },
  {
    slug: "beloved-cross",
    title: { en: "Beloved Cross", es: "Cruz Amada" },
    form: "easel-piece",
    blurb: {
      en: "Cross of white hydrangea anchored by hot-pink roses and a gold-lettered satin sash.",
      es: "Cruz de hortensias blancas anclada con rosas fucsia y banda de satín con letras doradas.",
    },
    image: "/sympathy/beloved-cross.jpg",
  },
  {
    slug: "lavender-heart-wreath",
    title: { en: "Lavender Heart Wreath", es: "Corona Lavanda" },
    form: "easel-piece",
    blurb: {
      en: "Open-heart wreath in lavender roses, purple orchids, and trailing amaranthus — quiet, full, sustained.",
      es: "Corazón abierto en rosas lavanda, orquídeas moradas y amaranto colgante — sereno, lleno, sostenido.",
    },
    image: "/sympathy/lavender-heart-wreath.jpg",
  },
  {
    slug: "garden-farewell",
    title: { en: "Garden Farewell", es: "Despedida de Jardín" },
    form: "standing-spray",
    blurb: {
      en: "Vertical garden-style piece — deep red roses centered, framed by yellow snapdragons, bells of Ireland, and white florals.",
      es: "Pieza vertical estilo jardín — rosas rojas al centro, enmarcadas por boca de dragón amarilla, campanas de Irlanda y flores blancas.",
    },
    image: "/sympathy/garden-farewell.jpg",
  },
  {
    slug: "pillar-of-white",
    title: { en: "Pillar of White", es: "Pilar Blanco" },
    form: "standing-spray",
    blurb: {
      en: "Tall white standing spray of garden roses, dendrobium orchids, and monstera — composure made visible.",
      es: "Tributo alto en blanco con rosas de jardín, orquídeas dendrobium y monstera — la compostura hecha forma.",
    },
    image: "/sympathy/pillar-of-white.jpg",
  },
  {
    slug: "white-cascade",
    title: { en: "White Cascade", es: "Cascada Blanca" },
    form: "standing-spray",
    blurb: {
      en: "Cascading white roses, orchids, and trailing greens on a tall easel — gentle gravity for the front of the room.",
      es: "Cascada de rosas blancas, orquídeas y verdes colgantes sobre caballete alto — gravedad suave para el frente del salón.",
    },
    image: "/sympathy/white-cascade.jpg",
  },
  {
    slug: "snow-tribute",
    title: { en: "Snow Tribute", es: "Tributo Nieve" },
    form: "standing-spray",
    blurb: {
      en: "White football mums, dendrobium, and lisianthus — a tribute that reads as silence rather than statement.",
      es: "Crisantemos blancos, dendrobium y lisianthus — un tributo que se lee como silencio, no declaración.",
    },
    image: "/sympathy/snow-tribute.jpg",
  },
  {
    slug: "casket-spray-red-white",
    title: { en: "Red & White Casket Spray", es: "Manto Fúnebre Rojo y Blanco" },
    form: "casket-spray",
    blurb: {
      en: "Long horizontal casket spray of red roses, white calla lilies, and trailing satin ribbon — designed to rest gently.",
      es: "Manto horizontal con rosas rojas, calas blancas y cinta de satín colgante — diseñado para descansar suave.",
    },
    image: "/sympathy/casket-spray-red-white.jpg",
  },
  {
    slug: "floral-wall-installation",
    title: { en: "Memorial Floral Wall", es: "Pared Floral Conmemorativa" },
    form: "installation",
    blurb: {
      en: "Floor-to-ceiling floral wall in mixed garden blooms — a one-of-one installation for memorials that need a room held.",
      es: "Pared floral de piso a techo con flores de jardín mixtas — instalación única para memoriales que necesitan sostener todo un salón.",
    },
    image: "/sympathy/floral-wall-installation.jpg",
  },
];
