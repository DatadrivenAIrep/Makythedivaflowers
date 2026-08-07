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
    slug: "heart-in-full-color",
    title: { en: "Heart in Full Color", es: "Corazón de Colores" },
    form: "easel-piece",
    blurb: {
      en: "An open-heart wreath in every color — roses and gerbera daisies in red, lavender, yellow, and blush, finished with a soft pink ribbon.",
      es: "Corona de corazón abierto en todos los colores — rosas y gerberas en rojo, lavanda, amarillo y rosa, rematada con una cinta rosa suave.",
    },
    image: "/sympathy/heart-in-full-color.webp",
  },
  {
    slug: "chapel-white",
    title: { en: "Chapel White", es: "Blanco de Capilla" },
    form: "standing-spray",
    blurb: {
      en: "A classic white standing spray of roses, snapdragon, and lily, framed in palm — composure for the front of the chapel.",
      es: "Clásico tributo blanco de pie con rosas, boca de dragón y lirios, enmarcado en palma — serenidad para el frente de la capilla.",
    },
    image: "/sympathy/chapel-white.webp",
  },
  {
    slug: "golden-grace",
    title: { en: "Golden Grace", es: "Gracia Dorada" },
    form: "standing-spray",
    blurb: {
      en: "A tall standing spray built on golden roses, bells of Ireland, and monstera — warmth for a life remembered in sunlight.",
      es: "Tributo de pie sobre rosas doradas, campanas de Irlanda y monstera — calidez para una vida recordada en luz.",
    },
    image: "/sympathy/golden-grace.webp",
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
    slug: "tender-heart",
    title: { en: "Tender Heart", es: "Corazón Tierno" },
    form: "easel-piece",
    blurb: {
      en: "A solid heart of pink and lavender roses on a fan of palm — soft, full, and unmistakably gentle.",
      es: "Corazón macizo de rosas rosadas y lavanda sobre un abanico de palma — suave, lleno e inconfundiblemente tierno.",
    },
    image: "/sympathy/tender-heart.webp",
  },
  {
    slug: "white-repose",
    title: { en: "White Repose", es: "Reposo Blanco" },
    form: "casket-spray",
    blurb: {
      en: "An all-white casket spray of roses, dendrobium, and calla lilies, cascading soft and low — quiet resting over the casket.",
      es: "Manto fúnebre todo en blanco con rosas, dendrobium y calas, en cascada baja y suave — descanso sereno sobre el féretro.",
    },
    image: "/sympathy/white-repose.webp",
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
    slug: "amethyst-orchid",
    title: { en: "Amethyst Orchid", es: "Orquídea Amatista" },
    form: "standing-spray",
    blurb: {
      en: "A white ground with a cascade of purple dendrobium orchids down the center, rooted in white roses and baby's breath.",
      es: "Una base blanca con una cascada de orquídeas dendrobium moradas al centro, anclada en rosas blancas y nube.",
    },
    image: "/sympathy/amethyst-orchid.webp",
  },
  {
    slug: "circle-of-warmth",
    title: { en: "Circle of Warmth", es: "Círculo de Calidez" },
    form: "easel-piece",
    blurb: {
      en: "A full wreath in warm tones — red and orange roses, cymbidium orchids, and green hydrangea, tied with a red bow.",
      es: "Corona plena en tonos cálidos — rosas rojas y naranjas, orquídeas cymbidium e hortensia verde, atada con un moño rojo.",
    },
    image: "/sympathy/circle-of-warmth.webp",
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
    slug: "eternal-white",
    title: { en: "Eternal White", es: "Blanco Eterno" },
    form: "casket-spray",
    blurb: {
      en: "A wide casket spray layered in white orchids, garden roses, and calla lilies — abundance kept entirely in white.",
      es: "Manto amplio en capas de orquídeas blancas, rosas de jardín y calas — abundancia mantenida por completo en blanco.",
    },
    image: "/sympathy/eternal-white.webp",
  },
  {
    slug: "cross-of-peace",
    title: { en: "Cross of Peace", es: "Cruz de Paz" },
    form: "easel-piece",
    blurb: {
      en: "A cross of white hydrangea with a cluster of blush roses at the crossing and trailing ribbon — faith made gentle.",
      es: "Cruz de hortensias blancas con un racimo de rosas rosadas en el centro y cinta colgante — la fe hecha ternura.",
    },
    image: "/sympathy/cross-of-peace.webp",
  },
  {
    slug: "crimson-heart",
    title: { en: "Crimson Heart", es: "Corazón Carmesí" },
    form: "easel-piece",
    blurb: {
      en: "A heart of white hydrangea broken by a bold diagonal of red roses and trailing amaranthus — grief and love, side by side.",
      es: "Corazón de hortensias blancas atravesado por una diagonal intensa de rosas rojas y amaranto colgante — el duelo y el amor, juntos.",
    },
    image: "/sympathy/crimson-heart.webp",
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
