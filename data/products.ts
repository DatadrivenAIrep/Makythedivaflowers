// data/products.ts
import type { Product } from "@/types/product";

const img = (slug: string, n: number, alt: { en: string; es: string }, aspect: "4/5" | "1/1" | "16/9" = "4/5") => ({
  src: `https://picsum.photos/seed/${slug}-${n}/1200/1500`,
  alt,
  aspect,
});

export const PRODUCTS: Product[] = [
  // ─── Arrangements (4) ─────────────────────────────────────
  {
    id: "p-arr-01",
    slug: "ruby-altar",
    title: { en: "Ruby Altar", es: "Altar Rubí" },
    category: "arrangements",
    blurb: {
      en: "Garden roses, ranunculus, and burgundy dahlia in our signature footed vase.",
      es: "Rosas de jardín, ranúnculos y dalia borgoña en nuestro jarrón con base.",
    },
    description: {
      en: "Built around fifteen garden-cut roses with ranunculus and burgundy dahlia, the Ruby Altar is our most-requested romantic arrangement. Each stem is conditioned for 24 hours before the build. Designed to last 7–9 days in cool light.",
      es: "Construido en torno a quince rosas cortadas en jardín con ranúnculos y dalia borgoña, el Altar Rubí es nuestro arreglo romántico más solicitado. Cada tallo se acondiciona durante 24 horas antes del montaje. Diseñado para durar 7–9 días con luz fresca.",
    },
    images: [
      img("ruby-altar", 1, { en: "Ruby Altar arrangement on a bone background", es: "Arreglo Altar Rubí sobre fondo hueso" }),
      img("ruby-altar", 2, { en: "Detail of garden roses and ranunculus", es: "Detalle de rosas de jardín y ranúnculos" }),
      img("ruby-altar", 3, { en: "Footed vase from above", es: "Jarrón con base desde arriba" }, "1/1"),
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 18700 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 26500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 38500 },
    ],
    addOns: [
      { id: "vase-upgrade", label: { en: "Heirloom vase upgrade", es: "Mejora a jarrón heredado" }, priceCents: 4500 },
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
    ],
    tags: ["staff-pick", "same-day"],
    occasions: ["romance", "anniversary"],
    colorFamily: ["red", "pink"],
    active: true,
    pairsWith: ["p-bou-02", "p-gif-01", "p-arr-03"],
    seo: {
      title: { en: "Ruby Altar — Diva Flowers", es: "Altar Rubí — Diva Flowers" },
      description: {
        en: "Romantic arrangement of garden roses, ranunculus, and dahlia. Same-day delivery on Long Island.",
        es: "Arreglo romántico de rosas de jardín, ranúnculos y dalia. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-02",
    slug: "petal-cathedral",
    title: { en: "Petal Cathedral", es: "Catedral de Pétalos" },
    category: "arrangements",
    blurb: {
      en: "A cloud of pale-pink peonies, garden roses, and trailing jasmine.",
      es: "Una nube de peonías rosa claro, rosas de jardín y jazmín colgante.",
    },
    description: {
      en: "Statement-scale arrangement built on a pedestal vase. Heavy on peony in season; substituted with double-petal garden roses in winter (always confirmed in advance).",
      es: "Arreglo a escala de declaración construido sobre un jarrón pedestal. Mucha peonía en temporada; sustituida con rosas dobles en invierno (siempre confirmado).",
    },
    images: [
      img("petal-cathedral", 1, { en: "Petal Cathedral pedestal arrangement", es: "Arreglo pedestal Catedral de Pétalos" }),
      img("petal-cathedral", 2, { en: "Pale pink peony detail", es: "Detalle de peonía rosa claro" }),
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 22500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 31200 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 42000 },
    ],
    addOns: [{ id: "vase-upgrade", label: { en: "Italian glass vase", es: "Jarrón de vidrio italiano" }, priceCents: 6500 }],
    tags: ["staff-pick", "seasonal"],
    occasions: ["romance", "anniversary", "just-because"],
    colorFamily: ["pink", "pastel"],
    active: true,
    pairsWith: ["p-arr-01", "p-bou-01"],
    seo: {
      title: { en: "Petal Cathedral — Diva Flowers", es: "Catedral de Pétalos — Diva Flowers" },
      description: {
        en: "Statement peony arrangement on a pedestal vase. Premium tier.",
        es: "Arreglo peonía a gran escala sobre jarrón pedestal. Nivel premium.",
      },
    },
  },
  {
    id: "p-arr-03",
    slug: "tangerine-mass",
    title: { en: "Tangerine Mass", es: "Misa Mandarina" },
    category: "arrangements",
    blurb: {
      en: "A volume study in coral roses, parrot tulips, and butterfly ranunculus.",
      es: "Un estudio de volumen en rosas coral, tulipanes loro y ranúnculos mariposa.",
    },
    description: {
      en: "Built unstructured — coral, peach, and warm citrus tones in a low compote vase. A great alternative when red feels too formal.",
      es: "Montaje no estructurado — tonos coral, durazno y cítrico cálido en un jarrón compota bajo. Excelente alternativa cuando el rojo es demasiado formal.",
    },
    images: [img("tangerine-mass", 1, { en: "Tangerine Mass low arrangement", es: "Arreglo bajo Misa Mandarina" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 24500 },
    ],
    tags: ["new"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Tangerine Mass — Diva Flowers", es: "Misa Mandarina — Diva Flowers" },
      description: {
        en: "Coral and peach low compote arrangement.",
        es: "Arreglo compota coral y durazno.",
      },
    },
  },
  {
    id: "p-arr-04",
    slug: "ivory-vow",
    title: { en: "Ivory Vow", es: "Voto Marfil" },
    category: "arrangements",
    blurb: {
      en: "Cream garden roses, lisianthus, and bleached eucalyptus on bone.",
      es: "Rosas de jardín crema, lisianto y eucalipto blanqueado sobre fondo hueso.",
    },
    description: {
      en: "Elegant all-white arrangement that reads as bridal but works for any quiet occasion. The lisianthus carries a subtle ruffle without going maximalist.",
      es: "Arreglo elegante en blanco que se lee como nupcial pero funciona para cualquier ocasión tranquila. El lisianto aporta un volado sutil sin caer en lo maximalista.",
    },
    images: [img("ivory-vow", 1, { en: "Ivory Vow all-white arrangement", es: "Arreglo blanco Voto Marfil" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 19500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 28000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 39500 },
    ],
    tags: ["same-day"],
    occasions: ["congrats", "anniversary", "just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Ivory Vow — Diva Flowers", es: "Voto Marfil — Diva Flowers" },
      description: {
        en: "All-white garden rose and lisianthus arrangement.",
        es: "Arreglo blanco de rosa de jardín y lisianto.",
      },
    },
  },

  // ─── Bouquets (4) ─────────────────────────────────────
  {
    id: "p-bou-01",
    slug: "morning-letter",
    title: { en: "The Morning Letter", es: "La Carta de la Mañana" },
    category: "bouquets",
    blurb: {
      en: "Hand-tied: blush roses, white anemone, eucalyptus, hand-trimmed at the studio.",
      es: "Atado a mano: rosas rubor, anémona blanca, eucalipto, recortado en el estudio.",
    },
    description: {
      en: "Our most-ordered hand-tied. Wrapped in unbleached parchment with a hand-tied raffia bow. Cut and arranged the morning of delivery.",
      es: "Nuestro ramo atado a mano más pedido. Envuelto en papel sin blanquear con lazo de rafia. Cortado y arreglado la mañana del envío.",
    },
    images: [img("morning-letter", 1, { en: "Hand-tied bouquet on parchment", es: "Ramo atado a mano sobre pergamino" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 12500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 18500 },
    ],
    tags: ["staff-pick", "same-day"],
    occasions: ["romance", "just-because", "birthday"],
    colorFamily: ["pink", "white"],
    active: true,
    seo: {
      title: { en: "The Morning Letter — Diva Flowers", es: "La Carta de la Mañana — Diva Flowers" },
      description: { en: "Hand-tied bouquet of blush roses and anemone.", es: "Ramo atado de rosa rubor y anémona." },
    },
  },
  {
    id: "p-bou-02",
    slug: "scarlet-note",
    title: { en: "Scarlet Note", es: "Nota Escarlata" },
    category: "bouquets",
    blurb: {
      en: "Twenty-five long-stem red roses, sleeved in our heavyweight rouge paper.",
      es: "Veinticinco rosas rojas de tallo largo, en nuestro papel rouge de alto gramaje.",
    },
    description: {
      en: "The classic. Long-stem red roses, conditioned for two days, delivered in our heavyweight wrap.",
      es: "El clásico. Rosas rojas de tallo largo, acondicionadas durante dos días, entregadas en nuestro envoltorio de alto gramaje.",
    },
    images: [img("scarlet-note", 1, { en: "Long-stem red roses in rouge paper", es: "Rosas rojas de tallo largo en papel rouge" })],
    variants: [
      { id: "standard", label: { en: "Standard · 25 stems", es: "Estándar · 25 tallos" }, priceCents: 18900 },
      { id: "grand", label: { en: "Grand · 50 stems", es: "Grandes · 50 tallos" }, priceCents: 31500 },
      { id: "diva", label: { en: "Diva · 100 stems", es: "Diva · 100 tallos" }, priceCents: 56000 },
    ],
    tags: ["same-day"],
    occasions: ["romance", "anniversary"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "Scarlet Note — Diva Flowers", es: "Nota Escarlata — Diva Flowers" },
      description: { en: "Long-stem red roses, premium build.", es: "Rosas rojas de tallo largo, calidad premium." },
    },
  },
  {
    id: "p-bou-03",
    slug: "sunday-walk",
    title: { en: "Sunday Walk", es: "Paseo Dominical" },
    category: "bouquets",
    blurb: {
      en: "Mixed seasonal field — anemone, sweet pea, ranunculus, varies weekly.",
      es: "Campo mixto de temporada — anémona, guisante de olor, ranúnculo, varía semanalmente.",
    },
    description: {
      en: "Our florist's choice — what's freshest at the market that week. Hand-tied, paper-wrapped. Always different, always good.",
      es: "Elección de nuestra florista — lo más fresco del mercado esa semana. Atado a mano, envuelto en papel. Siempre distinto, siempre bueno.",
    },
    images: [img("sunday-walk", 1, { en: "Mixed field bouquet", es: "Ramo de campo mixto" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 14500 },
    ],
    tags: ["seasonal", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["mixed", "pastel"],
    active: true,
    seo: {
      title: { en: "Sunday Walk — Diva Flowers", es: "Paseo Dominical — Diva Flowers" },
      description: { en: "Florist's-choice seasonal mixed bouquet.", es: "Ramo mixto de temporada elegido por la florista." },
    },
  },
  {
    id: "p-bou-04",
    slug: "alabaster-thread",
    title: { en: "Alabaster Thread", es: "Hilo Alabastro" },
    category: "bouquets",
    blurb: {
      en: "Cream peonies and bridal roses on bleached parchment.",
      es: "Peonías crema y rosas nupciales sobre pergamino blanqueado.",
    },
    description: {
      en: "Soft, all-white hand-tied. Perfect for new-baby visits, congratulations, and quiet anniversaries.",
      es: "Atado suave en blanco. Perfecto para visitas de bebé, felicitaciones y aniversarios tranquilos.",
    },
    images: [img("alabaster-thread", 1, { en: "All-white hand-tied bouquet", es: "Ramo atado a mano blanco" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 14500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 21000 },
    ],
    tags: ["new"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Alabaster Thread — Diva Flowers", es: "Hilo Alabastro — Diva Flowers" },
      description: { en: "Soft all-white hand-tied bouquet.", es: "Ramo atado a mano blanco y suave." },
    },
  },

  // ─── Plants (4) ─────────────────────────────────────
  {
    id: "p-pla-01",
    slug: "phalaenopsis-double-spike",
    title: { en: "Double-Spike Orchid", es: "Orquídea de Doble Vara" },
    category: "plants",
    blurb: {
      en: "Phalaenopsis with two spikes in a hand-thrown stoneware planter.",
      es: "Phalaenopsis con dos varas en macetero de gres hecho a mano.",
    },
    description: {
      en: "Six-week bloom window. Care card and watering syringe included.",
      es: "Florescencia de seis semanas. Incluye tarjeta de cuidado y jeringa de riego.",
    },
    images: [img("phalaenopsis-double-spike", 1, { en: "White double-spike phalaenopsis orchid", es: "Orquídea phalaenopsis blanca de doble vara" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 18500 },
      { id: "grand", label: { en: "Grand · Three spikes", es: "Grandes · Tres varas" }, priceCents: 26500 },
    ],
    tags: ["staff-pick"],
    occasions: ["congrats", "just-because", "sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Double-Spike Orchid — Diva Flowers", es: "Orquídea Doble Vara — Diva Flowers" },
      description: { en: "Phalaenopsis orchid in stoneware planter.", es: "Phalaenopsis en macetero de gres." },
    },
  },
  {
    id: "p-pla-02",
    slug: "fiddle-leaf-fig",
    title: { en: "Fiddle-Leaf Fig", es: "Ficus Lyrata" },
    category: "plants",
    blurb: { en: "Three-foot ficus lyrata in a glazed terracotta pot.", es: "Ficus lyrata de un metro en maceta de terracota esmaltada." },
    description: {
      en: "Studio-grown, ready to live in a bright corner. Stake and care card included.",
      es: "Cultivado en estudio, listo para una esquina luminosa. Incluye tutor y tarjeta de cuidado.",
    },
    images: [img("fiddle-leaf-fig", 1, { en: "Fiddle-leaf fig in glazed pot", es: "Ficus lyrata en maceta esmaltada" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 22500 }],
    tags: [],
    occasions: ["just-because", "congrats"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Fiddle-Leaf Fig — Diva Flowers", es: "Ficus Lyrata — Diva Flowers" },
      description: { en: "Three-foot fiddle-leaf fig in glazed terracotta.", es: "Ficus lyrata de un metro en terracota esmaltada." },
    },
  },
  {
    id: "p-pla-03",
    slug: "rosemary-topiary",
    title: { en: "Rosemary Topiary", es: "Romero Topiario" },
    category: "plants",
    blurb: { en: "Fragrant standard-form rosemary in a French zinc pot.", es: "Romero en forma estándar en maceta de zinc francesa." },
    description: { en: "Sun-loving, hardy. Smells like a Provençal kitchen.", es: "Le encanta el sol, resistente. Huele a cocina provenzal." },
    images: [img("rosemary-topiary", 1, { en: "Rosemary topiary in zinc pot", es: "Romero topiario en maceta de zinc" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 13500 }],
    tags: ["new", "same-day"],
    occasions: ["just-because"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Rosemary Topiary — Diva Flowers", es: "Romero Topiario — Diva Flowers" },
      description: { en: "Fragrant rosemary topiary in French zinc.", es: "Romero topiario en zinc francés." },
    },
  },
  {
    id: "p-pla-04",
    slug: "monstera-dwarf",
    title: { en: "Dwarf Monstera", es: "Monstera Enana" },
    category: "plants",
    blurb: { en: "Compact monstera deliciosa in a cream stoneware pot.", es: "Monstera deliciosa compacta en macetero de gres crema." },
    description: { en: "Easy-care, fast-growing. Lives happily in indirect light.", es: "Fácil de cuidar, crece rápido. Vive feliz con luz indirecta." },
    images: [img("monstera-dwarf", 1, { en: "Dwarf monstera in cream stoneware", es: "Monstera enana en gres crema" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 11500 }],
    tags: ["same-day"],
    occasions: ["just-because", "congrats"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Dwarf Monstera — Diva Flowers", es: "Monstera Enana — Diva Flowers" },
      description: { en: "Compact monstera in stoneware.", es: "Monstera compacta en gres." },
    },
  },

  // ─── Gifts (4) ─────────────────────────────────────
  {
    id: "p-gif-01",
    slug: "champagne-bouquet-pair",
    title: { en: "Champagne & Bouquet", es: "Champaña y Ramo" },
    category: "gifts",
    blurb: { en: "Hand-tied bouquet paired with a bottle of Veuve Clicquot.", es: "Ramo atado con una botella de Veuve Clicquot." },
    description: {
      en: "Pairing of our Sunday Walk bouquet with a chilled bottle of Veuve. Wrapped together with a tied raffia handle. ID required at delivery.",
      es: "Maridaje de nuestro Paseo Dominical con una botella fría de Veuve. Envuelto con asa de rafia atada. Se requiere identificación al entregar.",
    },
    images: [img("champagne-bouquet-pair", 1, { en: "Bouquet and Veuve Clicquot bottle", es: "Ramo y botella de Veuve Clicquot" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 19500 }],
    tags: ["staff-pick"],
    occasions: ["anniversary", "congrats", "romance"],
    colorFamily: ["mixed"],
    active: true,
    pairsWith: ["p-arr-01", "p-bou-02"],
    seo: {
      title: { en: "Champagne & Bouquet — Diva Flowers", es: "Champaña y Ramo — Diva Flowers" },
      description: { en: "Hand-tied bouquet with Veuve Clicquot.", es: "Ramo atado con Veuve Clicquot." },
    },
  },
  {
    id: "p-gif-02",
    slug: "studio-candle-trio",
    title: { en: "Studio Candle Trio", es: "Trío de Velas del Estudio" },
    category: "gifts",
    blurb: { en: "Three of our house-poured tuberose candles.", es: "Tres de nuestras velas de nardo hechas en casa." },
    description: { en: "House-poured at the studio in soy + coconut wax. 50-hour burn each.", es: "Vertidas en el estudio en cera de soya + coco. 50 horas de quemado cada una." },
    images: [img("studio-candle-trio", 1, { en: "Trio of tuberose candles", es: "Trío de velas de nardo" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9800 }],
    tags: ["new"],
    occasions: ["just-because", "congrats", "birthday"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Studio Candle Trio — Diva Flowers", es: "Trío de Velas — Diva Flowers" },
      description: { en: "Three house-poured tuberose candles.", es: "Tres velas de nardo hechas en casa." },
    },
  },
  {
    id: "p-gif-03",
    slug: "patisserie-box",
    title: { en: "Pâtisserie Box", es: "Caja Pâtisserie" },
    category: "gifts",
    blurb: { en: "A small bouquet with a box of Long Island macarons.", es: "Un ramo pequeño con una caja de macarrones de Long Island." },
    description: { en: "Petite hand-tied paired with twelve macarons from a Garden City pâtissier.", es: "Pequeño atado a mano con doce macarrones de un pâtissier de Garden City." },
    images: [img("patisserie-box", 1, { en: "Petite bouquet with macaron box", es: "Pequeño ramo con caja de macarrones" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 13500 }],
    tags: ["same-day"],
    occasions: ["birthday", "congrats", "just-because"],
    colorFamily: ["pastel", "pink"],
    active: true,
    seo: {
      title: { en: "Pâtisserie Box — Diva Flowers", es: "Caja Pâtisserie — Diva Flowers" },
      description: { en: "Petite bouquet plus macarons.", es: "Pequeño ramo y macarrones." },
    },
  },
  {
    id: "p-gif-04",
    slug: "mother-after-noon",
    title: { en: "Mother & Afternoon", es: "Madre y la Tarde" },
    category: "gifts",
    blurb: { en: "A reading-day box: bouquet, novel, candle, kraft thermos.", es: "Caja de día de lectura: ramo, novela, vela, termo kraft." },
    description: { en: "Curated quarterly. The novel rotates each season — current selection on the listing.", es: "Curada trimestralmente. La novela rota por temporada — selección actual en la ficha." },
    images: [img("mother-after-noon", 1, { en: "Curated reading-day gift box", es: "Caja regalo de día de lectura" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 }],
    tags: ["seasonal"],
    occasions: ["birthday", "just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Mother & Afternoon — Diva Flowers", es: "Madre y la Tarde — Diva Flowers" },
      description: { en: "Curated reading-day gift box.", es: "Caja regalo curada para día de lectura." },
    },
  },

  // ─── Sympathy (4) ─────────────────────────────────────
  {
    id: "p-sym-01",
    slug: "white-vespers",
    title: { en: "White Vespers", es: "Vísperas Blancas" },
    category: "sympathy",
    blurb: { en: "Cream lilies, white roses, and bleached eucalyptus on a low platform.", es: "Lirios crema, rosas blancas y eucalipto blanqueado en una base baja." },
    description: { en: "Low, restrained arrangement appropriate for service or home. Wrapped without ribbon.", es: "Arreglo bajo y contenido, adecuado para servicio u hogar. Envuelto sin lazo." },
    images: [img("white-vespers", 1, { en: "All-white sympathy arrangement", es: "Arreglo de condolencias blanco" })],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 18500 },
      { id: "grand", label: { en: "Grand", es: "Grandes" }, priceCents: 26500 },
    ],
    tags: [],
    occasions: ["sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "White Vespers — Diva Flowers", es: "Vísperas Blancas — Diva Flowers" },
      description: { en: "Sympathy arrangement of white lily and rose.", es: "Arreglo de condolencias de lirio y rosa blancos." },
    },
  },
  {
    id: "p-sym-02",
    slug: "evening-prayer",
    title: { en: "Evening Prayer", es: "Oración de la Noche" },
    category: "sympathy",
    blurb: { en: "Standing spray for service: white roses, lily, and eucalyptus on an easel.", es: "Pieza de pie: rosas blancas, lirio y eucalipto sobre caballete." },
    description: { en: "Built on a brass easel for funeral services. Two-day lead time recommended.", es: "Montado sobre caballete de latón para servicios. Se recomienda 2 días de antelación." },
    images: [img("evening-prayer", 1, { en: "Sympathy standing spray on easel", es: "Pieza de condolencias en caballete" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 32500 }],
    tags: [],
    occasions: ["sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Evening Prayer — Diva Flowers", es: "Oración de la Noche — Diva Flowers" },
      description: { en: "Standing sympathy spray for funeral services.", es: "Pieza de pie para servicios funerarios." },
    },
  },
  {
    id: "p-sym-03",
    slug: "kindly-orchid",
    title: { en: "Kindly Orchid", es: "Orquídea Bondadosa" },
    category: "sympathy",
    blurb: { en: "Single-spike phalaenopsis in a stoneware planter for the home.", es: "Phalaenopsis de una sola vara en macetero de gres para el hogar." },
    description: { en: "A quiet, lasting gesture for the home of a grieving family. Bloom window six weeks.", es: "Un gesto tranquilo y duradero para el hogar de una familia en duelo. Florescencia de seis semanas." },
    images: [img("kindly-orchid", 1, { en: "White phalaenopsis in stoneware", es: "Phalaenopsis blanca en gres" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 }],
    tags: ["same-day"],
    occasions: ["sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Kindly Orchid — Diva Flowers", es: "Orquídea Bondadosa — Diva Flowers" },
      description: { en: "Phalaenopsis orchid for sympathy.", es: "Phalaenopsis para condolencias." },
    },
  },
  {
    id: "p-sym-04",
    slug: "stillwater-wreath",
    title: { en: "Stillwater Wreath", es: "Corona Aguas Tranquilas" },
    category: "sympathy",
    blurb: { en: "20-inch wreath of cream rose and bay laurel.", es: "Corona de 50 cm de rosa crema y laurel." },
    description: { en: "Suitable for service or door. Bay-laurel base lasts well past bloom.", es: "Adecuada para servicio o puerta. La base de laurel dura más allá de la florescencia." },
    images: [img("stillwater-wreath", 1, { en: "Cream rose and laurel wreath", es: "Corona de rosa crema y laurel" })],
    variants: [
      { id: "standard", label: { en: "Standard · 20 in", es: "Estándar · 50 cm" }, priceCents: 21500 },
      { id: "grand", label: { en: "Grand · 28 in", es: "Grandes · 70 cm" }, priceCents: 32500 },
    ],
    tags: [],
    occasions: ["sympathy"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Stillwater Wreath — Diva Flowers", es: "Corona Aguas Tranquilas — Diva Flowers" },
      description: { en: "Cream rose and bay laurel wreath.", es: "Corona de rosa crema y laurel." },
    },
  },

  // ─── Subscriptions (4 tiers) ─────────────────────────────────────
  {
    id: "p-sub-01",
    slug: "petite-subscription",
    title: { en: "Petite — Weekly", es: "Petite — Semanal" },
    category: "subscriptions",
    blurb: { en: "A small hand-tied delivered every week, florist's choice.", es: "Un pequeño atado a mano entregado cada semana, elección de la florista." },
    description: { en: "Choose your day. Pause anytime. Cancel anytime.", es: "Elige tu día. Pausa cuando quieras. Cancela cuando quieras." },
    images: [img("petite-subscription", 1, { en: "Petite weekly subscription bouquet", es: "Ramo de suscripción semanal Petite" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 }],
    subscription: { cadences: ["weekly", "biweekly"] },
    tags: ["staff-pick"],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Petite Subscription — Diva Flowers", es: "Suscripción Petite — Diva Flowers" },
      description: { en: "Small weekly hand-tied bouquet.", es: "Pequeño ramo semanal atado a mano." },
    },
  },
  {
    id: "p-sub-02",
    slug: "studio-subscription",
    title: { en: "Studio — Weekly", es: "Studio — Semanal" },
    category: "subscriptions",
    blurb: { en: "Our weekly Sunday Walk-style bouquet, in standard size.", es: "Nuestro ramo semanal estilo Paseo Dominical, en tamaño estándar." },
    description: { en: "Choose your day. Pause anytime.", es: "Elige tu día. Pausa cuando quieras." },
    images: [img("studio-subscription", 1, { en: "Standard weekly subscription bouquet", es: "Ramo semanal estándar" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 16500 }],
    subscription: { cadences: ["weekly", "biweekly"] },
    tags: [],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Studio Subscription — Diva Flowers", es: "Suscripción Studio — Diva Flowers" },
      description: { en: "Standard weekly bouquet subscription.", es: "Suscripción de ramo semanal estándar." },
    },
  },
  {
    id: "p-sub-03",
    slug: "salon-subscription",
    title: { en: "Salon — Biweekly", es: "Salon — Quincenal" },
    category: "subscriptions",
    blurb: { en: "A statement arrangement every other week.", es: "Un arreglo de declaración cada dos semanas." },
    description: { en: "For consistent presence in a foyer or office.", es: "Para presencia constante en recibidor u oficina." },
    images: [img("salon-subscription", 1, { en: "Statement biweekly arrangement", es: "Arreglo quincenal de declaración" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 24500 }],
    subscription: { cadences: ["biweekly"] },
    tags: [],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Salon Subscription — Diva Flowers", es: "Suscripción Salon — Diva Flowers" },
      description: { en: "Statement arrangement biweekly.", es: "Arreglo de declaración quincenal." },
    },
  },
  {
    id: "p-sub-04",
    slug: "atelier-subscription",
    title: { en: "Atelier — Weekly", es: "Atelier — Semanal" },
    category: "subscriptions",
    blurb: { en: "Our largest tier — a Diva-scale arrangement every week.", es: "Nuestro mayor nivel — un arreglo escala Diva cada semana." },
    description: { en: "For lobbies, restaurants, and very floral households.", es: "Para lobbies, restaurantes y hogares muy florales." },
    images: [img("atelier-subscription", 1, { en: "Diva-scale weekly arrangement", es: "Arreglo semanal escala Diva" })],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 34500 }],
    subscription: { cadences: ["weekly"] },
    tags: ["staff-pick"],
    occasions: ["just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Atelier Subscription — Diva Flowers", es: "Suscripción Atelier — Diva Flowers" },
      description: { en: "Largest weekly arrangement subscription.", es: "Mayor suscripción semanal de arreglos." },
    },
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(cat: string): Product[] {
  return PRODUCTS.filter((p) => p.active && p.category === cat);
}

export function getPairsWith(product: Product): Product[] {
  if (product.pairsWith && product.pairsWith.length > 0) {
    return product.pairsWith
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p): p is Product => Boolean(p && p.active));
  }
  return PRODUCTS.filter(
    (p) => p.active && p.id !== product.id && p.category === product.category,
  ).slice(0, 4);
}
