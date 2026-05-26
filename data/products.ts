// data/products.ts
import type { Product } from "@/types/product";

const img = (slug: string, n: number, alt: { en: string; es: string }, aspect: "4/5" | "1/1" | "16/9" = "4/5") => ({
  src: `https://picsum.photos/seed/${slug}-${n}/1200/1500`,
  alt,
  aspect,
});

export const PRODUCTS: Product[] = [
  // ─── Maky catalog import — pilot (8) ─────────────────────
  {
    id: "p-arr-m01",
    slug: "a-thousand-heartbeats",
    title: { en: "A Thousand Heartbeats", es: "Mil Latidos" },
    category: "arrangements",
    blurb: {
      en: "For the anniversary that deserves more than the dinner reservation — roses and dahlia, hand-built that morning.",
      es: "Para el aniversario que merece más que la cena reservada: rosas y dalia armadas a mano la mañana misma.",
    },
    description: {
      en: "Dense composition of red garden roses and burgundy dahlia over seasonal greenery, set in a low vase made for the dining table. This is the gift that says 'I remembered' before the card is even opened — the kind of gesture that takes years of practice to look this effortless. Order before 2:00 pm and it walks through her door this afternoon, hand-built today on Long Island.",
      es: "Composición densa de rosas rojas y dalia borgoña sobre follaje de temporada, montada en jarrón bajo para la mesa del comedor. Este es el regalo que dice «me acuerdo» antes de que se abra la tarjeta — el detalle que toma años de práctica para verse así de natural. Ordénalo antes de las 2:00 pm y entra por su puerta esta tarde, hecho a mano hoy en Long Island.",
    },
    images: [
      {
        src: "/products/a-thousand-heartbeats.jpg",
        alt: { en: "Red rose and dahlia arrangement in a low vase, front view", es: "Arreglo de rosas rojas y dalia en jarrón bajo, vista frontal" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 19100, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 25500 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 34400, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day", "staff-pick"],
    occasions: ["romance", "anniversary"],
    colorFamily: ["red", "pink"],
    active: true,
    seo: {
      title: { en: "A Thousand Heartbeats — Anniversary | Diva Flowers", es: "Mil Latidos — Aniversario | Diva Flowers" },
      description: {
        en: "Red roses and dahlia in a low vase, hand-built. Anniversary, romance. Same-day delivery on Long Island.",
        es: "Rosas rojas y dalia en jarrón bajo, hecho a mano. Aniversario, romance. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-m01",
    slug: "dozen-roses-bouquet",
    title: { en: "Dozen Roses Bouquet", es: "Ramo de Doce Rosas" },
    category: "bouquets",
    blurb: {
      en: "Twelve red roses, hand-tied and delivered to her door — the classic, done the way it should be done.",
      es: "Doce rosas rojas atadas a mano y entregadas en su puerta — el clásico, hecho como tiene que hacerse.",
    },
    description: {
      en: "Twelve long-stem red roses, hand-tied and wrapped in matte paper — no plastic ribbon, no theatrics. These aren't the roses you grab on the way home; these are the ones that say the person thought it through before leaving the office. Order before 2:00 pm and they go out today on Long Island, fresh from the morning cut.",
      es: "Doce rosas rojas de tallo largo, atadas a mano y envueltas en papel mate — sin cinta plástica, sin floritura. No son las rosas que uno agarra de pasada; son las que demuestran que la persona lo pensó antes de salir de la oficina. Ordénalas antes de las 2:00 pm y salen hoy mismo en Long Island, recién cortadas esa mañana.",
    },
    images: [
      {
        src: "/products/dozen-roses-bouquet.jpg",
        alt: { en: "Twelve red roses wrapped in matte paper, tied with cord", es: "Doce rosas rojas envueltas en papel mate, atadas con cordón" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 7900, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 10500 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 14200, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day"],
    occasions: ["romance", "anniversary", "birthday", "congrats", "just-because"],
    colorFamily: ["red"],
    active: false,
    seo: {
      title: { en: "Dozen Red Roses Bouquet | Diva Flowers", es: "Ramo de Doce Rosas Rojas | Diva Flowers" },
      description: {
        en: "Twelve hand-tied red roses in matte wrap. Romance, anniversary. Same-day delivery on Long Island.",
        es: "Doce rosas rojas atadas a mano en papel mate. Romance, aniversario. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-m02",
    slug: "hundred-roses-vase",
    title: { en: "Hundred Roses Vase", es: "Cien Rosas en Jarrón" },
    category: "arrangements",
    blurb: {
      en: "One hundred red roses in a single tall vase — the room changes before she finishes reading the card.",
      es: "Cien rosas rojas en un solo jarrón alto — la habitación cambia antes de que termine de leer la tarjeta.",
    },
    description: {
      en: "One hundred red roses arranged in a tall glass vase, built stem by stem across the morning of delivery. This is for the anniversaries you count on two hands, the proposals planned in silence, the thank-yous that don't fit in a sentence. Reserve at least 24 hours ahead anywhere in Long Island and we'll build all hundred the day they ship — book yours before stems run out for the week.",
      es: "Cien rosas rojas en jarrón alto de cristal, construidas tallo por tallo durante toda la mañana del envío. Es para los aniversarios que se cuentan con las dos manos, las pedidas de mano planeadas en silencio, los «gracias» que no caben en una frase. Reserva con 24 horas mínimo dentro de Long Island y armamos las cien el día de la entrega — sepárala antes de que se acaben los tallos de la semana.",
    },
    images: [
      {
        src: "/products/hundred-roses-vase.png",
        alt: { en: "One hundred red roses arranged in a tall glass vase", es: "Cien rosas rojas dispuestas en un jarrón de cristal alto" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 47200, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 62900 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 84900, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day", "staff-pick"],
    occasions: ["romance", "anniversary"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "Hundred Red Roses Vase — Premium | Diva Flowers", es: "Cien Rosas Rojas en Jarrón — Premium | Diva Flowers" },
      description: {
        en: "One hundred red roses in a tall vase, hand-built. For anniversaries that count. Long Island, book 24 hours ahead.",
        es: "Cien rosas rojas en jarrón alto, hecho a mano. Para los aniversarios que cuentan. Long Island, reserva con 24 horas.",
      },
    },
  },
  {
    id: "p-bou-m02",
    slug: "sunburst-garden",
    title: { en: "Sunburst Garden", es: "Jardín al Sol" },
    category: "bouquets",
    blurb: {
      en: "Sunflowers, gerbera, and yellow roses, hand-tied — the flowers that walk into the party first.",
      es: "Girasoles, gerberas y rosas amarillas atados a mano — la flor que entra primero a la fiesta.",
    },
    description: {
      en: "Hand-tied bouquet of sunflowers, orange gerbera, and yellow roses, bound with natural cord. This is the birthday gift that arrives before the cake and leaves the house five degrees warmer — chosen for the person who doesn't need more things, just more mornings like this one. Order before 2:00 pm and we hand them off at her door today, anywhere on Long Island.",
      es: "Ramo de mano con girasoles, gerberas naranjas y rosas amarillas, atado con cordón natural. Es el regalo de cumpleaños que llega antes que la torta y deja la casa cinco grados más cálida — pensado para la persona que ya no necesita más cosas, sino más mañanas como esta. Ordénalo antes de las 2:00 pm y lo entregamos en su puerta hoy mismo, en cualquier parte de Long Island.",
    },
    images: [
      {
        src: "/products/sunburst-garden.jpg",
        alt: { en: "Hand-tied bouquet of sunflowers, orange gerbera, and yellow roses", es: "Ramo atado a mano de girasoles, gerberas naranjas y rosas amarillas" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 11300, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 15000 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 20300, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day"],
    occasions: ["birthday", "congrats", "just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Sunburst Garden — Birthday Bouquet | Diva Flowers", es: "Jardín al Sol — Ramo Cumpleaños | Diva Flowers" },
      description: {
        en: "Sunflowers, gerbera, and yellow roses, hand-tied. Birthday gift. Same-day delivery on Long Island.",
        es: "Girasoles, gerberas y rosas amarillas atados a mano. Regalo de cumpleaños. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-m03",
    slug: "rainforest-rhapsody",
    title: { en: "Rainforest Rhapsody", es: "Rapsodia Selvática" },
    category: "arrangements",
    blurb: {
      en: "Anthurium, monstera, and orchid — closer to a greenhouse than a centerpiece, built to be photographed.",
      es: "Antúrios, monstera y orquídeas — más invernadero que centro de mesa, hecho para ser fotografiado.",
    },
    description: {
      en: "Tropical arrangement of red anthurium, monstera leaf, orchid, and heliconia on a low mossed base. Built for long dining tables, generous entryways, or anyone who collects pieces that get posted before the dinner guests arrive. Order before 2:00 pm and we build it the day it ships — same-afternoon delivery on Long Island while it's still in season.",
      es: "Arreglo tropical de antúrios rojos, follaje monstera, orquídeas y heliconias sobre base baja con musgo. Hecho para mesas largas, recibidores con espacio o para quien colecciona piezas que se publican antes de que lleguen los invitados a cenar. Ordénalo antes de las 2:00 pm y lo construimos el día del envío — entrega esa misma tarde en Long Island mientras dura la temporada.",
    },
    images: [
      {
        src: "/products/rainforest-rhapsody.jpg",
        alt: { en: "Tropical arrangement on a low base with red anthurium, monstera leaves, and orchids", es: "Arreglo tropical en base baja con antúrios rojos, hojas de monstera y orquídeas" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 24800, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 33000 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 44600, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "just-because"],
    colorFamily: ["green", "mixed"],
    active: true,
    seo: {
      title: { en: "Rainforest Rhapsody — Tropical Arrangement | Diva", es: "Rapsodia Selvática — Arreglo Tropical | Diva" },
      description: {
        en: "Tropical arrangement with anthurium, monstera, and orchid on a low base. Long Island, same-day.",
        es: "Arreglo tropical con antúrios, monstera y orquídeas sobre base baja. Long Island, mismo día.",
      },
    },
  },
  {
    id: "p-gif-m01",
    slug: "designers-choice",
    title: { en: "Designer's Choice", es: "A Elección de la Florista" },
    category: "gifts",
    blurb: {
      en: "You pick the budget — the florist picks from what's freshest in the studio this week.",
      es: "Tú pones el presupuesto — la florista escoge entre lo más fresco del taller esta semana.",
    },
    description: {
      en: "You choose the amount; the florist picks the bloom from this week's market cut. This is the gift for the person who knows Monday's stems beat three days of looking for 'something nice' — and the last-minute order that still walks in looking thought through. Order before 2:00 pm and we hand-build it for same-afternoon delivery anywhere on Long Island.",
      es: "Tú eliges el monto y la florista escoge la flor del corte fresco de esta semana. Es el regalo de quien sabe que los tallos del lunes valen más que tres días buscando «algo bonito» — y la orden de último minuto que igual termina viéndose pensada. Ordénalo antes de las 2:00 pm y lo armamos a mano para entrega esa misma tarde en cualquier parte de Long Island.",
    },
    images: [
      {
        src: "/products/designers-choice.png",
        alt: { en: "Diva Flowers logo on a light background — designer's choice placeholder", es: "Logotipo de Diva Flowers sobre fondo claro — marcador a elección de la florista" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 11300, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 15000 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 20300, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day", "staff-pick"],
    occasions: ["just-because", "congrats", "birthday"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Designer's Choice — Florist's Pick | Diva Flowers", es: "A Elección de la Florista | Diva Flowers" },
      description: {
        en: "You set the budget, the florist picks the day's flower. Same-day delivery on Long Island.",
        es: "Tú eliges el presupuesto, la florista elige la flor del día. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-m03",
    slug: "velvet-sun",
    title: { en: "Velvet Sun", es: "Sol de Terciopelo" },
    category: "bouquets",
    blurb: {
      en: "A small hand-tied in warm yellows — the Wednesday flower, for days that don't ask for a reason.",
      es: "Pequeño ramo de mano en amarillos cálidos — la flor de los miércoles, para días que no piden razón.",
    },
    description: {
      en: "Right-sized hand-tied bouquet in warm yellows and cream, bound with natural cord. This is the 'thinking of you' that doesn't turn into an event — it fits the work desk, the small apartment table, the kitchen ledge, without making a fuss. Order before 2:00 pm and we hand it off at her door this same afternoon on Long Island.",
      es: "Ramo de mano de tamaño justo en amarillos cálidos y crema, atado con cordón natural. Es el «pensé en ti» que no se vuelve evento — cabe en el escritorio del trabajo, en la mesa pequeña del apartamento, en la repisa de la cocina sin pedir permiso. Ordénalo antes de las 2:00 pm y lo entregamos esa misma tarde en su puerta, en Long Island.",
    },
    images: [
      {
        src: "/products/velvet-sun.jpg",
        alt: { en: "Small bouquet of yellow and cream flowers tied with natural cord", es: "Ramo pequeño de flores amarillas y crema atado con cordón natural" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 5600, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 7500 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 10100, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["mixed", "pastel"],
    active: true,
    seo: {
      title: { en: "Velvet Sun — Small Hand-Tied Bouquet | Diva Flowers", es: "Sol de Terciopelo — Ramo Pequeño | Diva Flowers" },
      description: {
        en: "Small bouquet in warm yellows, hand-tied. No occasion needed. Long Island, same-day.",
        es: "Ramo pequeño en amarillos cálidos, atado a mano. Sin ocasión. Long Island, mismo día.",
      },
    },
  },
  {
    id: "p-bou-m04",
    slug: "katsobad",
    title: { en: "Katsobad", es: "Katsobad" },
    category: "bouquets",
    blurb: {
      en: "A hand-tied mixed bouquet in warm tones — the one that arrives with you and stays through the weekend.",
      es: "Ramo mixto de mano en tonos cálidos — el que llega contigo y se queda hasta el fin de semana.",
    },
    description: {
      en: "Mixed hand-tied bouquet of garden roses, alstroemeria, and seasonal greenery, bound with natural cord. This is the host gift that doesn't compete with the dinner or the conversation — it walks in with the guest, lands on the coffee table, and still looks good when the leftovers come out on Sunday. Order before 2:00 pm and walk in with it tonight anywhere on Long Island.",
      es: "Ramo mixto en mano con rosas de jardín, alstroemerias y follaje de temporada, atado con cordón natural. Es el regalo de visita que no compite con la cena ni con la conversación — entra con la persona, se queda en la mesa de centro y sigue viéndose bien cuando salen las sobras el domingo. Ordénalo antes de las 2:00 pm y entra con él esta noche, en cualquier parte de Long Island.",
    },
    images: [
      {
        src: "/products/katsobad.jpg",
        alt: { en: "Hand-tied mixed bouquet with roses and green foliage tied with cord", es: "Ramo mixto en mano con rosas y follaje verde atado con cordón" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 14300, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 19000 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 25700, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["same-day", "new"],
    occasions: ["romance", "anniversary", "just-because", "birthday", "congrats"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Katsobad — Hand-Tied Mixed Bouquet | Diva Flowers", es: "Katsobad — Ramo Mixto Atado | Diva Flowers" },
      description: {
        en: "Mixed hand-tied bouquet with roses and alstroemeria. Visit gift. Long Island, same-day.",
        es: "Ramo mixto con rosas y alstroemerias atado a mano. Regalo de visita. Long Island, mismo día.",
      },
    },
  },

  // ─── New catalog imports — Batch 1 (29) ─────────────────
  {
    id: "p-arr-b1-01",
    slug: "abundant-table",
    title: { en: "Abundant Table", es: "Mesa Abundante" },
    category: "arrangements",
    blurb: {
      en: "A low centerpiece for the host who feeds everyone twice.",
      es: "Centro de mesa bajo para quien sirve dos platos a todos.",
    },
    description: {
      en: "For the host who treats every Sunday like a holiday — garden roses, ranunculus, and trailing greens kept low so conversation crosses the table. Drop it on her counter the morning of, and watch the dinner change shape. Order before 2pm for same-day delivery across Long Island.",
      es: "Para quien convierte cada domingo en fiesta — rosas de jardín, ranúnculos y verdes que caen, todo bajo para que la conversación cruce la mesa. Llévalo a su cocina la mañana del evento y mira cómo cambia la cena. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/abundant-table.jpg", alt: { en: "Abundant Table low centerpiece arrangement", es: "Centro de mesa Mesa Abundante" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 10900, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 14500 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 19600, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    addOns: [
      { id: "candles", label: { en: "Add taper candle pair", es: "Añadir par de velas" }, priceCents: 2500 },
    ],
    tags: ["new", "same-day", "staff-pick", "seasonal"],
    occasions: ["just-because", "congrats"],
    colorFamily: ["mixed"],
    active: true,
    seasonMonths: [9, 10, 11],
    seo: {
      title: { en: "Abundant Table — Diva Flowers", es: "Mesa Abundante — Diva Flowers" },
      description: {
        en: "Low garden-style centerpiece for hosts. Same-day delivery on Long Island.",
        es: "Centro de mesa bajo estilo jardín. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-01",
    slug: "all-my-love",
    title: { en: "All My Love", es: "Todo Mi Amor" },
    category: "bouquets",
    blurb: {
      en: "Red garden roses for the anniversary they'll keep talking about.",
      es: "Rosas rojas de jardín para el aniversario del que seguirán hablando.",
    },
    description: {
      en: "For the partner who counts the years and the small Tuesday moments equally — twenty-four red garden roses, hand-tied with eucalyptus and a ribbon they'll save. Order before 2pm and we'll have it on Long Island doorsteps the same afternoon. The kind of bouquet that turns a regular dinner into the story you tell next year.",
      es: "Para quien cuenta los años y también los martes cualquiera — veinticuatro rosas rojas de jardín, atadas a mano con eucalipto y un lazo que guardarán. Pídelo antes de las 2pm y llegará a Long Island esta misma tarde. El ramo que convierte una cena cualquiera en la historia que contarán el año entrante.",
    },
    images: [
      { src: "/products/all-my-love.jpg", alt: { en: "All My Love red rose bouquet", es: "Ramo Todo Mi Amor de rosas rojas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 10900, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 14500 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 19600, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    addOns: [
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["anniversary", "romance", "birthday", "congrats", "just-because"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "All My Love — Diva Flowers", es: "Todo Mi Amor — Diva Flowers" },
      description: {
        en: "Red garden rose anniversary bouquet. Same-day delivery on Long Island.",
        es: "Ramo aniversario de rosas rojas de jardín. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-02",
    slug: "aloha-aura",
    title: { en: "Aloha Aura", es: "Aura Aloha" },
    category: "arrangements",
    blurb: {
      en: "Tropical brights that turn a Tuesday into a postcard.",
      es: "Tropicales encendidos que convierten un martes en postal.",
    },
    description: {
      en: "For the friend whose group chat is mostly screenshots of beaches — birds of paradise, anthurium, and monstera packed loud and warm. Send it on the gray Monday she didn't know she needed. Order before 2pm and we'll have it on her Long Island doorstep before dinner.",
      es: "Para la amiga cuyo chat son puras fotos de playas — aves del paraíso, anturios y monstera, todo intenso y cálido. Mándaselo el lunes gris que no sabía que necesitaba. Pídelo antes de las 2pm y estará en su puerta de Long Island antes de la cena.",
    },
    images: [
      { src: "/products/aloha-aura.jpg", alt: { en: "Aloha Aura tropical arrangement", es: "Arreglo tropical Aura Aloha" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because", "congrats", "mothers-day"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Aloha Aura — Diva Flowers", es: "Aura Aloha — Diva Flowers" },
      description: {
        en: "Tropical birthday arrangement with birds of paradise. Same-day on Long Island.",
        es: "Arreglo tropical de cumpleaños con aves del paraíso. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-03",
    slug: "amethyst-snowdrop",
    title: { en: "Amethyst Snowdrop", es: "Amatista Nevada" },
    category: "arrangements",
    blurb: {
      en: "Lavender and white blooms with a quiet, jeweled hush.",
      es: "Lavandas y blancos con un silencio enjoyado.",
    },
    description: {
      en: "For the friend who wears layered linen and means it — purple lisianthus, white anemones, and silver dusty miller, set in a soft cluster. Send it for the promotion she's downplaying. Order before 2pm for same-day delivery across Long Island, and let the flowers do the cheering she won't.",
      es: "Para la amiga del lino en capas que sí lo lleva bien — lisianthus morado, anémonas blancas y dusty miller plateado, en un grupo suave. Mándaselo por el ascenso que está restando importancia. Pídelo antes de las 2pm para entrega el mismo día en Long Island, y deja que las flores celebren lo que ella no.",
    },
    images: [
      { src: "/products/amethyst-snowdrop.jpg", alt: { en: "Amethyst Snowdrop lavender and white arrangement", es: "Arreglo Amatista Nevada lavanda y blanco" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["congrats", "just-because", "birthday"],
    colorFamily: ["pastel", "white"],
    active: true,
    seo: {
      title: { en: "Amethyst Snowdrop — Diva Flowers", es: "Amatista Nevada — Diva Flowers" },
      description: {
        en: "Lavender and white arrangement for quiet milestones. Same-day on Long Island.",
        es: "Arreglo lavanda y blanco para hitos discretos. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-sym-b1-01",
    slug: "angels-touch",
    title: { en: "Angel's Touch", es: "Caricia de Ángel" },
    category: "arrangements",
    blurb: {
      en: "All-white blooms — quiet, abundant, and timeless.",
      es: "Flores blancas — discretas, abundantes y atemporales.",
    },
    description: {
      en: "White roses, lilies, and hydrangea, kept calm and full. The arrangement that reads as elegance without trying — for Mother's Day, for an anniversary, for the gentle thank-you that words don't quite reach. Hand-delivered across Long Island the same day. Order before 2pm and we'll have it at her door before evening.",
      es: "Rosas blancas, lirios y hortensia, en calma y llenas. El arreglo que se lee como elegancia sin intentarlo — para el Día de la Madre, para un aniversario, para el gracias al que las palabras no terminan de llegar. Entregamos en Long Island el mismo día. Pide antes de las 2pm y estará en su puerta antes de la noche.",
    },
    images: [
      { src: "/products/angels-touch.jpg", alt: { en: "Angel's Touch all-white floral arrangement", es: "Arreglo floral en blancos Caricia de Ángel" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["mothers-day", "anniversary", "romance", "just-because", "sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Angel's Touch — All-White Arrangement | Diva Flowers", es: "Caricia de Ángel — Arreglo en Blanco | Diva Flowers" },
      description: {
        en: "All-white arrangement of roses, lilies, and hydrangea. Same-day delivery on Long Island.",
        es: "Arreglo en blancos: rosas, lirios y hortensia. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-04",
    slug: "autumn-orchard",
    title: { en: "Autumn Orchard", es: "Huerto de Otoño" },
    category: "arrangements",
    blurb: {
      en: "Russet roses and copper leaves, cut from late October light.",
      es: "Rosas color óxido y hojas de cobre, cortadas de la luz de octubre.",
    },
    description: {
      en: "For the cousin who hosts the Friendsgiving every year and pretends it's no big deal — terracotta roses, dahlias, and oak in a low ceramic. Set it on her table the morning of and let her exhale. Order before 2pm for same-day delivery across Long Island.",
      es: "Para la prima que arma el Friendsgiving cada año fingiendo que no es nada — rosas terracota, dalias y roble en cerámica baja. Déjalo en su mesa la mañana del evento y deja que respire. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/autumn-orchard.jpg", alt: { en: "Autumn Orchard fall-toned arrangement", es: "Arreglo otoñal Huerto de Otoño" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day", "seasonal"],
    occasions: ["just-because", "congrats"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Autumn Orchard — Diva Flowers", es: "Huerto de Otoño — Diva Flowers" },
      description: {
        en: "Fall-toned centerpiece with terracotta roses. Same-day on Long Island.",
        es: "Centro de mesa otoñal con rosas terracota. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-05",
    slug: "autumns-cornucopia",
    title: { en: "Autumn's Cornucopia", es: "Cornucopia de Otoño" },
    category: "arrangements",
    blurb: {
      en: "A spilled-over harvest piece for the head of the table.",
      es: "Una cosecha que se desborda, para la cabecera de la mesa.",
    },
    description: {
      en: "For the grandmother who plates the turkey and somehow remembers everyone's allergies — a horn-of-plenty packed with bronze mums, mini pumpkins, and wheat. Send it the day before the holiday so she sees it before the rush. Order before 2pm for same-day delivery on Long Island.",
      es: "Para la abuela que sirve el pavo y se acuerda de las alergias de todos — cornucopia con crisantemos bronce, calabacitas y trigo. Mándalo la víspera para que lo vea antes del ajetreo. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/autumns-cornucopia.jpg", alt: { en: "Autumn's Cornucopia harvest arrangement", es: "Arreglo de cosecha Cornucopia de Otoño" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 18500 },
    ],
    tags: ["new", "seasonal"],
    occasions: ["birthday", "congrats", "just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Autumn's Cornucopia — Diva Flowers", es: "Cornucopia de Otoño — Diva Flowers" },
      description: {
        en: "Harvest cornucopia centerpiece for fall holidays. Same-day on Long Island.",
        es: "Cornucopia de cosecha para fiestas de otoño. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-gif-b1-01",
    slug: "berry-bliss-basket",
    title: { en: "Berry Bliss Basket", es: "Canasta Frutos Rojos" },
    category: "gifts",
    blurb: {
      en: "Raspberry and plum blooms tucked into a market basket.",
      es: "Frambuesas y ciruelas en flor dentro de una canasta de mercado.",
    },
    description: {
      en: "For the friend recovering at home who keeps insisting she's fine — burgundy dahlias, raspberry roses, and blackberry vine in a woven basket she'll reuse. Send it instead of a text. Order before 2pm and it's at her Long Island door this afternoon — the gift from someone who actually shows up.",
      es: "Para la amiga en reposo que jura estar bien — dalias borgoña, rosas frambuesa y rama de mora en canasta tejida que reutilizará. Mándaselo en vez de un texto. Pídelo antes de las 2pm y estará en su puerta de Long Island esta tarde — el detalle de quien sí aparece.",
    },
    images: [
      { src: "/products/berry-bliss-basket.jpg", alt: { en: "Berry Bliss Basket with burgundy blooms", es: "Canasta Frutos Rojos con flores borgoña" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 9500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 13500 },
    ],
    addOns: [
      { id: "chocolates", label: { en: "Add dark chocolate truffles", es: "Añadir trufas de chocolate" }, priceCents: 2500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday", "get-well"],
    colorFamily: ["red", "mixed"],
    active: true,
    seo: {
      title: { en: "Berry Bliss Basket — Diva Flowers", es: "Canasta Frutos Rojos — Diva Flowers" },
      description: {
        en: "Burgundy and raspberry basket gift. Same-day delivery on Long Island.",
        es: "Canasta en borgoña y frambuesa. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-02",
    slug: "blush-enchantment",
    title: { en: "Blush Enchantment", es: "Encanto Rubor" },
    category: "bouquets",
    blurb: {
      en: "Blush roses and ranunculus for the slow yes.",
      es: "Rosas rubor y ranúnculos para el sí que toma su tiempo.",
    },
    description: {
      en: "For the date that's becoming something — soft pink garden roses, ranunculus, and astilbe wrapped in kraft and tied loose. Send it the morning of dinner so she's already smiling when you knock. Order before 2pm and we'll have it at her Long Island door before you finish parking.",
      es: "Para la cita que se está convirtiendo en algo — rosas de jardín rosa pálido, ranúnculos y astilbe en papel kraft, atados sin apretar. Mándalo la mañana de la cena para que ya esté sonriendo cuando llegues. Pídelo antes de las 2pm y estará en su puerta de Long Island antes de que termines de estacionarte.",
    },
    images: [
      { src: "/products/blush-enchantment.jpg", alt: { en: "Blush Enchantment pink rose bouquet", es: "Ramo Encanto Rubor de rosas rosadas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 9400, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 12500 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 16900, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "just-because", "mothers-day"],
    colorFamily: ["pink", "pastel"],
    active: true,
    seo: {
      title: { en: "Blush Enchantment — Diva Flowers", es: "Encanto Rubor — Diva Flowers" },
      description: {
        en: "Blush pink garden rose bouquet. Same-day delivery on Long Island.",
        es: "Ramo rosa pálido de rosas de jardín. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-06",
    slug: "botanic-fireworks",
    title: { en: "Botanic Fireworks", es: "Fuegos Botánicos" },
    category: "arrangements",
    blurb: {
      en: "Spider mums and alliums bursting like a Fourth of July sky.",
      es: "Crisantemos araña y allium estallando como un cielo de feria.",
    },
    description: {
      en: "For the friend whose energy doesn't match the weather — purple alliums, lime spider mums, and craspedia firing in every direction. Send it on the day she lands the new role. Order before 2pm for same-day delivery on Long Island and let the bouquet match her decibel level.",
      es: "Para la amiga cuya energía no le pide permiso al clima — alliums morados, crisantemos araña verdes y craspedia disparando en todas direcciones. Mándalo el día que firme el nuevo puesto. Pídelo antes de las 2pm para entrega el mismo día en Long Island y que el ramo le iguale los decibeles.",
    },
    images: [
      { src: "/products/botanic-fireworks.jpg", alt: { en: "Botanic Fireworks burst arrangement", es: "Arreglo Fuegos Botánicos" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["congrats", "birthday"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Botanic Fireworks — Diva Flowers", es: "Fuegos Botánicos — Diva Flowers" },
      description: {
        en: "Loud, celebratory arrangement for promotions and wins. Same-day on Long Island.",
        es: "Arreglo eufórico para ascensos y triunfos. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-gif-b1-02",
    slug: "botanical-basket",
    title: { en: "Botanical Basket", es: "Canasta Botánica" },
    category: "gifts",
    blurb: {
      en: "A garden gathered into a basket, foraged-feeling and full.",
      es: "Un jardín recogido en canasta, con aire de paseo entre setos.",
    },
    description: {
      en: "For the neighbor who borrows pruning shears and returns them sharper — wildflowers, herbs, and trailing ivy in a market basket she'll plant up later. Send it on a regular Wednesday. Order before 2pm and we'll have it on her Long Island porch the same afternoon — the small gesture that lands big.",
      es: "Para la vecina que pide tijeras prestadas y las devuelve afiladas — flores de campo, hierbas y hiedra en canasta de mercado que después usará para sembrar. Mándalo un miércoles cualquiera. Pídelo antes de las 2pm y estará en su porche de Long Island esta tarde — el detalle pequeño que cae fuerte.",
    },
    images: [
      { src: "/products/botanical-basket.jpg", alt: { en: "Botanical Basket of wildflowers and herbs", es: "Canasta Botánica de flores silvestres y hierbas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 6500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 9500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 13500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday", "get-well"],
    colorFamily: ["mixed", "green"],
    active: true,
    seo: {
      title: { en: "Botanical Basket — Diva Flowers", es: "Canasta Botánica — Diva Flowers" },
      description: {
        en: "Foraged-style wildflower basket gift. Same-day delivery on Long Island.",
        es: "Canasta de flores silvestres estilo paseo. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-03",
    slug: "butterfly-kiss",
    title: { en: "Butterfly Kiss", es: "Beso de Mariposa" },
    category: "bouquets",
    blurb: {
      en: "Sweet pea, ranunculus, and a flutter of soft yellows.",
      es: "Guisante de olor, ranúnculos y un aleteo de amarillos suaves.",
    },
    description: {
      en: "For the goddaughter turning seven and the mother turning fifty — butter-yellow ranunculus, sweet pea, and white astilbe, light enough to carry one-handed. Send it for the small Saturday that deserves more than a card. Order before 2pm for same-day delivery across Long Island.",
      es: "Para la ahijada que cumple siete y la madre que cumple cincuenta — ranúnculos amarillo mantequilla, guisante de olor y astilbe blanco, ligero para cargarlo con una mano. Mándalo por el sábado chico que merece más que una tarjeta. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/butterfly-kiss.jpg", alt: { en: "Butterfly Kiss soft yellow bouquet", es: "Ramo Beso de Mariposa amarillo suave" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 10500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 14500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because", "mothers-day"],
    colorFamily: ["pastel"],
    active: true,
    seo: {
      title: { en: "Butterfly Kiss — Diva Flowers", es: "Beso de Mariposa — Diva Flowers" },
      description: {
        en: "Soft-yellow birthday bouquet with sweet pea. Same-day on Long Island.",
        es: "Ramo de cumpleaños amarillo suave con guisante. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-pla-b1-01",
    slug: "cattleya-orchid",
    title: { en: "Cattleya Orchid", es: "Orquídea Cattleya" },
    category: "plants",
    blurb: {
      en: "A lavender cattleya that blooms again if you let it.",
      es: "Una cattleya lavanda que vuelve a florecer si la dejas.",
    },
    description: {
      en: "For the friend who keeps every plant alive on benign neglect — a single ruffled cattleya in a stoneware pot, packed with care notes she won't need. Send it for the housewarming or the long apology. Order before 2pm for same-day delivery on Long Island; it'll be on her counter by evening.",
      es: "Para la amiga que mantiene plantas vivas con cariñoso descuido — una cattleya ondulada en maceta de gres, con notas de cuidado que no le harán falta. Mándalo por la inauguración o por la disculpa larga. Pídelo antes de las 2pm para entrega el mismo día en Long Island; estará en su barra antes del anochecer.",
    },
    images: [
      { src: "/products/cattleya-orchid.jpg", alt: { en: "Lavender Cattleya orchid in stoneware pot", es: "Orquídea Cattleya lavanda en maceta de gres" }, aspect: "4/5" },
    ],
    variants: [
      { id: "petite", label: { en: "Petite (single stem)", es: "Petite (un tallo)" }, priceCents: 7500 },
      { id: "standard", label: { en: "Standard (double stem)", es: "Estándar (dos tallos)" }, priceCents: 11500 },
      { id: "grand", label: { en: "Grand (triple stem)", es: "Grande (tres tallos)" }, priceCents: 15500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["just-because", "congrats", "birthday"],
    colorFamily: ["pastel"],
    active: true,
    seo: {
      title: { en: "Cattleya Orchid — Diva Flowers", es: "Orquídea Cattleya — Diva Flowers" },
      description: {
        en: "Lavender Cattleya orchid in stoneware. Same-day delivery on Long Island.",
        es: "Cattleya lavanda en maceta de gres. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-04",
    slug: "celeste-bloom",
    title: { en: "Celeste Bloom", es: "Celeste en Flor" },
    category: "bouquets",
    blurb: {
      en: "Sky-blue delphinium and white roses, light as a clear morning.",
      es: "Delphinium azul cielo y rosas blancas, livianos como mañana clara.",
    },
    description: {
      en: "For the friend who notices the weather before her phone — pale blue delphinium, white roses, and silver brunia gathered loose. Send it on her first day at the new firm. Order before 2pm for same-day delivery on Long Island and let her walk in already steadied.",
      es: "Para la amiga que mira el cielo antes que el teléfono — delphinium azul pálido, rosas blancas y brunia plateada, atados sin apretar. Mándalo el primer día en la firma nueva. Pídelo antes de las 2pm para entrega el mismo día en Long Island y que entre ya con piso firme.",
    },
    images: [
      { src: "/products/celeste-bloom.jpg", alt: { en: "Celeste Bloom blue and white bouquet", es: "Ramo Celeste en Flor azul y blanco" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["white", "mixed"],
    active: true,
    seo: {
      title: { en: "Celeste Bloom — Diva Flowers", es: "Celeste en Flor — Diva Flowers" },
      description: {
        en: "Sky-blue and white delphinium bouquet. Same-day on Long Island.",
        es: "Ramo azul cielo y blanco con delphinium. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-sym-b1-02",
    slug: "celestial-peace",
    title: { en: "Celestial Peace", es: "Paz Celestial" },
    category: "sympathy",
    blurb: {
      en: "White lilies and stock for the silence that follows.",
      es: "Lirios blancos y alhelí para el silencio que sigue.",
    },
    description: {
      en: "For the colleague burying a parent this week — white casa blanca lilies, stock, and dendrobium in a tall, dignified arrangement. Send it to the funeral home in his name; we'll deliver across Long Island the same day if you order before 2pm. The kind of presence that doesn't ask anything of him.",
      es: "Para el colega que esta semana entierra a un padre — lirios casa blanca, alhelí y dendrobium en arreglo alto y digno. Mándalo a la funeraria a su nombre; entregamos en Long Island el mismo día si pides antes de las 2pm. Una presencia que no le pide nada a cambio.",
    },
    images: [
      { src: "/products/celestial-peace.jpg", alt: { en: "Celestial Peace white lily sympathy arrangement", es: "Arreglo de condolencia Paz Celestial con lirios blancos" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 11500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["sympathy"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Celestial Peace — Diva Flowers", es: "Paz Celestial — Diva Flowers" },
      description: {
        en: "Tall white lily sympathy arrangement. Same-day delivery on Long Island.",
        es: "Arreglo alto de condolencia con lirios blancos. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-05",
    slug: "cloud-nine",
    title: { en: "Cloud Nine", es: "Nube Nueve" },
    category: "bouquets",
    blurb: {
      en: "Pillowy white hydrangea and roses for the news that lifts.",
      es: "Hortensias y rosas blancas, mullidas para la noticia que eleva.",
    },
    description: {
      en: "For the friend whose voicemail just said \"call me back\" in the good way — white hydrangea, garden roses, and lisianthus, soft and full enough to hide behind. Send it before she has to repeat the news. Order before 2pm for same-day delivery on Long Island.",
      es: "Para la amiga cuyo mensaje dijo \"llámame\" del bueno — hortensias blancas, rosas de jardín y lisianthus, suaves y llenos como para esconderse atrás. Mándalo antes de que tenga que repetir la noticia. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/cloud-nine.jpg", alt: { en: "Cloud Nine white hydrangea bouquet", es: "Ramo Nube Nueve de hortensia blanca" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 18500 },
    ],
    addOns: [
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "congrats", "just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Cloud Nine — Diva Flowers", es: "Nube Nueve — Diva Flowers" },
      description: {
        en: "White hydrangea and rose bouquet for big news. Same-day on Long Island.",
        es: "Ramo de hortensia y rosa blanca para la buena noticia. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-07",
    slug: "cottage-garden-charm",
    title: { en: "Cottage Garden Charm", es: "Encanto de Jardín de Cabaña" },
    category: "arrangements",
    blurb: {
      en: "Snapdragons, foxglove, and roses like an English back gate.",
      es: "Boca de dragón, dedalera y rosas como portón inglés.",
    },
    description: {
      en: "For the friend who reads gardening books in winter — pink snapdragons, foxglove spires, and English roses tumbled in a footed bowl. Send it the week she finally lists the house. Order before 2pm and it's at her Long Island door this afternoon, looking like she grew it herself.",
      es: "Para la amiga que lee libros de jardinería en invierno — boca de dragón rosas, dedaleras y rosas inglesas, derramadas en un cuenco con pie. Mándalo la semana que por fin pone la casa en venta. Pídelo antes de las 2pm y estará en su puerta de Long Island esta tarde, como si lo hubiera cultivado ella.",
    },
    images: [
      { src: "/products/cottage-garden-charm.jpg", alt: { en: "Cottage Garden Charm English-style arrangement", es: "Arreglo estilo inglés Encanto de Jardín" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Clásico" }, priceCents: 9400, subtitle: { en: "Lower stem count, same care", es: "Menos tallos, mismo cuidado" } },
      { id: "lush", label: { en: "Lush", es: "Generoso" }, priceCents: 12500 },
      { id: "opulent", label: { en: "Opulent", es: "Opulento" }, priceCents: 16900, subtitle: { en: "+35% more stems, larger vase", es: "+35% más tallos, jarrón más grande" } },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["just-because", "birthday", "congrats"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Cottage Garden Charm — Diva Flowers", es: "Encanto de Jardín de Cabaña — Diva Flowers" },
      description: {
        en: "English-cottage style arrangement with foxglove. Same-day on Long Island.",
        es: "Arreglo estilo cottage inglés con dedalera. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-06",
    slug: "darling-lucy",
    title: { en: "Darling Lucy", es: "Querida Lucy" },
    category: "bouquets",
    blurb: {
      en: "Pink peonies and ranunculus for the one named after her grandmother.",
      es: "Peonías rosadas y ranúnculos para la que lleva el nombre de su abuela.",
    },
    description: {
      en: "For the friend everyone calls by the same childhood nickname — pink peonies, coral ranunculus, and silver dollar eucalyptus, hand-tied like she's worth fussing over. Send it the day before her birthday so the morning starts already lit. Order before 2pm for same-day delivery across Long Island.",
      es: "Para la amiga a la que todos siguen llamando por su apodo de niña — peonías rosadas, ranúnculos coral y eucalipto plateado, atados a mano como quien la cuida. Mándalo la víspera del cumpleaños para que la mañana arranque encendida. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/darling-lucy.jpg", alt: { en: "Darling Lucy pink peony bouquet", es: "Ramo Querida Lucy de peonías rosadas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["romance", "anniversary", "birthday", "just-because"],
    colorFamily: ["pink"],
    active: true,
    seo: {
      title: { en: "Darling Lucy — Diva Flowers", es: "Querida Lucy — Diva Flowers" },
      description: {
        en: "Pink peony and ranunculus bouquet. Same-day delivery on Long Island.",
        es: "Ramo de peonías rosadas y ranúnculos. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-gif-b1-03",
    slug: "daydream-parcel",
    title: { en: "Daydream Parcel", es: "Paquete de Ensueño" },
    category: "gifts",
    blurb: {
      en: "A wrapped bundle of pastels for the long lunch.",
      es: "Un paquete envuelto en pasteles para la comida larga.",
    },
    description: {
      en: "For the friend who books the Tuesday lunch and orders dessert first — a kraft-wrapped bundle of pale pink, peach, and butter blooms with a hand-tied ribbon. Send it ahead so it's waiting at the table. Order before 2pm and we'll have it on Long Island doorsteps the same afternoon.",
      es: "Para la amiga que reserva la comida del martes y pide el postre primero — un paquete en kraft con flores rosa pálido, durazno y mantequilla, atado a mano. Mándalo antes para que esté esperándola en la mesa. Pídelo antes de las 2pm y llegará a Long Island esta misma tarde.",
    },
    images: [
      { src: "/products/daydream-parcel.jpg", alt: { en: "Daydream Parcel pastel wrapped bouquet", es: "Paquete de Ensueño en pasteles" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 6500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 9500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 13500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday", "mothers-day"],
    colorFamily: ["pastel"],
    active: true,
    seo: {
      title: { en: "Daydream Parcel — Diva Flowers", es: "Paquete de Ensueño — Diva Flowers" },
      description: {
        en: "Kraft-wrapped pastel bouquet gift. Same-day delivery on Long Island.",
        es: "Ramo pastel envuelto en kraft. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-08",
    slug: "designers-choice-maky",
    title: { en: "Designer's Choice — Maky", es: "Elección del Diseñador — Maky" },
    category: "arrangements",
    blurb: {
      en: "Trust Maky with the season's best stems and a free hand.",
      es: "Confía en Maky con lo mejor del mercado y mano libre.",
    },
    description: {
      en: "For the buyer who already knows our work and wants the room to surprise them — Maky pulls the morning's freshest stems and builds something we'll photograph before it leaves. Tell us a color, an occasion, or just \"go\". Order before 2pm for same-day delivery on Long Island; the gift from someone who trusts the florist.",
      es: "Para quien ya conoce nuestro trabajo y quiere espacio para sorprenderse — Maky escoge los tallos frescos de la mañana y arma algo que fotografiamos antes de que salga. Cuéntanos un color, una ocasión, o un \"tú decides\". Pídelo antes de las 2pm para entrega el mismo día en Long Island; el regalo de quien confía en el florista.",
    },
    images: [
      { src: "/products/designers-choice-maky.jpg", alt: { en: "Designer's Choice arrangement by Maky", es: "Arreglo Elección del Diseñador por Maky" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 19500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "birthday", "congrats", "just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Designer's Choice — Maky — Diva Flowers", es: "Elección del Diseñador — Maky — Diva Flowers" },
      description: {
        en: "Florist-designed arrangement using the day's best stems. Same-day on Long Island.",
        es: "Arreglo del diseñador con lo más fresco del día. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-07",
    slug: "dew-kissed",
    title: { en: "Dew Kissed", es: "Rocío Fresco" },
    category: "bouquets",
    blurb: {
      en: "White and green stems gathered like a back-garden walk.",
      es: "Blancos y verdes recogidos como paseo de huerta.",
    },
    description: {
      en: "For the friend who runs at six and texts you the sunrise — white anemones, green hellebore, and seeded eucalyptus, hand-tied with twine. Send it on the morning of her first half marathon. Order before 2pm and we'll have it on her Long Island porch by the time she's stretching.",
      es: "Para la amiga que corre a las seis y te manda el amanecer — anémonas blancas, hellebore verde y eucalipto en semilla, atados con cordel. Mándalo la mañana de su primera media maratón. Pídelo antes de las 2pm y estará en su porche de Long Island antes de que termine de estirar.",
    },
    images: [
      { src: "/products/dew-kissed.jpg", alt: { en: "Dew Kissed white and green bouquet", es: "Ramo Rocío Fresco blanco y verde" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Dew Kissed — Diva Flowers", es: "Rocío Fresco — Diva Flowers" },
      description: {
        en: "White and green hand-tied bouquet. Same-day delivery on Long Island.",
        es: "Ramo blanco y verde atado a mano. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-09",
    slug: "dona-rosita",
    title: { en: "Doña Rosita", es: "Doña Rosita" },
    category: "arrangements",
    blurb: {
      en: "Old-school roses for the matriarch who runs the family.",
      es: "Rosas a la antigua para la matriarca que sostiene a todos.",
    },
    description: {
      en: "For the abuela who still sets the table for ten and calls everyone mijo — coral and cream roses, snapdragons, and stock in a footed compote, full and proud. Send it for her saint's day before anyone else remembers. Order before 2pm for same-day delivery on Long Island.",
      es: "Para la abuela que pone la mesa para diez y a todos llama mijo — rosas coral y crema, boca de dragón y alhelí en compotera con pie, llenos y con porte. Mándalo por el santo antes de que nadie más se acuerde. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/dona-rosita.jpg", alt: { en: "Doña Rosita coral and cream rose arrangement", es: "Arreglo Doña Rosita coral y crema" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "birthday", "just-because"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Doña Rosita — Diva Flowers", es: "Doña Rosita — Diva Flowers" },
      description: {
        en: "Coral and cream rose arrangement for matriarchs. Same-day on Long Island.",
        es: "Arreglo coral y crema para matriarcas. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-08",
    slug: "dozen-roses-in-multi-color",
    title: { en: "Dozen Roses — Multi-Color", es: "Docena de Rosas — Multicolor" },
    category: "bouquets",
    blurb: {
      en: "Twelve roses, every color on the cart, hand-tied loud.",
      es: "Doce rosas, todos los colores del carro, atadas con bullicio.",
    },
    description: {
      en: "For the friend who can't pick a favorite anything — twelve roses in red, pink, yellow, peach, and white, hand-tied with eucalyptus. Send it for the birthday she keeps minimizing. Order before 2pm for same-day delivery on Long Island; the bouquet from someone who knows she contains multitudes.",
      es: "Para la amiga que no puede elegir un favorito de nada — doce rosas en rojo, rosado, amarillo, durazno y blanco, atadas a mano con eucalipto. Mándalo por el cumpleaños que sigue minimizando. Pídelo antes de las 2pm para entrega el mismo día en Long Island; el ramo de quien sabe que ella es muchas a la vez.",
    },
    images: [
      { src: "/products/dozen-roses-in-multi-color.jpg", alt: { en: "Dozen multi-color roses bouquet", es: "Docena de rosas multicolor" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard (12 roses)", es: "Estándar (12 rosas)" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand (24 roses)", es: "Grande (24 rosas)" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva (36 roses)", es: "Diva (36 rosas)" }, priceCents: 18500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["mixed"],
    active: false,
    seo: {
      title: { en: "Dozen Multi-Color Roses — Diva Flowers", es: "Docena Rosas Multicolor — Diva Flowers" },
      description: {
        en: "Twelve mixed-color roses, hand-tied. Same-day delivery on Long Island.",
        es: "Doce rosas mezcladas atadas a mano. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-09",
    slug: "dozen-roses-in-pink",
    title: { en: "Dozen Roses — Pink", es: "Docena de Rosas — Rosa" },
    category: "bouquets",
    blurb: {
      en: "Twelve pink roses for the slow, definite I love you.",
      es: "Doce rosas rosadas para el te quiero pausado y firme.",
    },
    description: {
      en: "For the partner who reads the card before opening anything else — twelve pink roses, hand-tied with eucalyptus and a soft satin ribbon. Send it for the anniversary she's already counting down to. Order before 2pm and we'll have it on her Long Island doorstep this afternoon.",
      es: "Para quien lee la tarjeta antes de abrir cualquier otra cosa — doce rosas rosadas, atadas a mano con eucalipto y lazo de satén suave. Mándalo por el aniversario que ya está contando. Pídelo antes de las 2pm y estará en su puerta de Long Island esta tarde.",
    },
    images: [
      { src: "/products/dozen-roses-in-pink.png", alt: { en: "Dozen pink roses bouquet", es: "Docena de rosas rosadas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard (12 roses)", es: "Estándar (12 rosas)" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand (24 roses)", es: "Grande (24 rosas)" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva (36 roses)", es: "Diva (36 rosas)" }, priceCents: 18500 },
    ],
    addOns: [
      { id: "chocolates", label: { en: "Add chocolate truffles", es: "Añadir trufas de chocolate" }, priceCents: 2500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "birthday", "congrats", "just-because"],
    colorFamily: ["pink"],
    active: false,
    seo: {
      title: { en: "Dozen Pink Roses — Diva Flowers", es: "Docena Rosas Rosadas — Diva Flowers" },
      description: {
        en: "Twelve pink roses, hand-tied. Same-day delivery on Long Island.",
        es: "Doce rosas rosadas atadas a mano. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-10",
    slug: "dozen-roses-in-vase",
    title: { en: "Dozen Roses in Vase", es: "Docena de Rosas en Florero" },
    category: "bouquets",
    blurb: {
      en: "Twelve red roses arranged in glass — no scrambling for a vase.",
      es: "Doce rosas rojas en florero — sin buscar dónde ponerlas.",
    },
    description: {
      en: "For the partner who's still at the office and won't have time to hunt for a vase — twelve red roses arranged in a clear glass cylinder, ready to set on the desk and breathe. Send it before her three o'clock meeting. Order before 2pm for same-day delivery across Long Island; the bouquet from someone who plans the small things.",
      es: "Para la pareja que sigue en la oficina y no va a tener tiempo de buscar florero — doce rosas rojas montadas en cilindro de vidrio, listas para poner en el escritorio y respirar. Mándalo antes de la reunión de las tres. Pídelo antes de las 2pm para entrega el mismo día en Long Island; el detalle de quien piensa lo chico.",
    },
    images: [
      { src: "/products/dozen-roses-in-vase.jpg", alt: { en: "Dozen red roses arranged in glass vase", es: "Docena de rosas rojas en florero de vidrio" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard (12 roses + vase)", es: "Estándar (12 rosas + florero)" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand (24 roses + vase)", es: "Grande (24 rosas + florero)" }, priceCents: 14500 },
      { id: "diva", label: { en: "Diva (36 roses + vase)", es: "Diva (36 rosas + florero)" }, priceCents: 20500 },
    ],
    addOns: [
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "birthday", "congrats", "just-because"],
    colorFamily: ["red"],
    active: false,
    seo: {
      title: { en: "Dozen Roses in Vase — Diva Flowers", es: "Docena Rosas en Florero — Diva Flowers" },
      description: {
        en: "Twelve red roses arranged in glass. Same-day delivery on Long Island.",
        es: "Doce rosas rojas en florero de vidrio. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-11",
    slug: "dozen-roses-in-white",
    title: { en: "Dozen Roses — White", es: "Docena de Rosas — Blanca" },
    category: "bouquets",
    blurb: {
      en: "Twelve white roses for the moment that needs no color.",
      es: "Doce rosas blancas para el momento que no necesita color.",
    },
    description: {
      en: "For the friend who said yes, the colleague who graduated, the mother who stayed up late — twelve white roses, hand-tied with eucalyptus and a long ribbon. Send it for the milestone that doesn't need fanfare, just acknowledgement. Order before 2pm for same-day delivery on Long Island.",
      es: "Para la amiga que dijo que sí, la colega que se graduó, la madre que se desveló — doce rosas blancas, atadas a mano con eucalipto y un lazo largo. Mándalo por el hito que no quiere bombo, solo que lo nombren. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/dozen-roses-in-white.png", alt: { en: "Dozen white roses bouquet", es: "Docena de rosas blancas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard (12 roses)", es: "Estándar (12 rosas)" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand (24 roses)", es: "Grande (24 rosas)" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva (36 roses)", es: "Diva (36 rosas)" }, priceCents: 18500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["romance", "anniversary", "congrats", "sympathy"],
    colorFamily: ["white"],
    active: false,
    seo: {
      title: { en: "Dozen White Roses — Diva Flowers", es: "Docena Rosas Blancas — Diva Flowers" },
      description: {
        en: "Twelve white roses, hand-tied. Same-day delivery on Long Island.",
        es: "Doce rosas blancas atadas a mano. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-12",
    slug: "dozen-roses-in-yellow",
    title: { en: "Dozen Roses — Yellow", es: "Docena de Rosas — Amarilla" },
    category: "bouquets",
    blurb: {
      en: "Twelve yellow roses for old friendships that hold up.",
      es: "Doce rosas amarillas para amistades viejas que aguantan.",
    },
    description: {
      en: "For the best friend who answered the 11pm phone call last week — twelve yellow roses, hand-tied with eucalyptus, no occasion required. Send it on a Tuesday because Tuesdays don't usually get flowers. Order before 2pm and we'll have it at her Long Island door before dinner.",
      es: "Para la mejor amiga que contestó la llamada de las once la semana pasada — doce rosas amarillas, atadas a mano con eucalipto, sin pretexto. Mándalo un martes porque los martes no suelen tener flores. Pídelo antes de las 2pm y estará en su puerta de Long Island antes de la cena.",
    },
    images: [
      { src: "/products/dozen-roses-in-yellow.png", alt: { en: "Dozen yellow roses bouquet", es: "Docena de rosas amarillas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard (12 roses)", es: "Estándar (12 rosas)" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand (24 roses)", es: "Grande (24 rosas)" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva (36 roses)", es: "Diva (36 rosas)" }, priceCents: 18500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday", "congrats"],
    colorFamily: ["mixed"],
    active: false,
    seo: {
      title: { en: "Dozen Yellow Roses — Diva Flowers", es: "Docena Rosas Amarillas — Diva Flowers" },
      description: {
        en: "Twelve yellow roses for friendship. Same-day delivery on Long Island.",
        es: "Doce rosas amarillas para la amistad. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b1-10",
    slug: "dulce-vida",
    title: { en: "Dulce Vida", es: "Dulce Vida" },
    category: "arrangements",
    blurb: {
      en: "Coral, peach, and gold blooms with weekend energy.",
      es: "Coral, durazno y dorado con energía de fin de semana.",
    },
    description: {
      en: "For the friend who turns the patio into a dance floor by ten — coral roses, peach ranunculus, and golden craspedia in a low ceramic. Send it for the housewarming she keeps postponing. Order before 2pm for same-day delivery across Long Island and let the party start before the guests do.",
      es: "Para la amiga que convierte el patio en pista para las diez — rosas coral, ranúnculos durazno y craspedia dorada en cerámica baja. Mándalo por la inauguración que sigue posponiendo. Pídelo antes de las 2pm para entrega el mismo día en Long Island y que la fiesta empiece antes que los invitados.",
    },
    images: [
      { src: "/products/dulce-vida.jpg", alt: { en: "Dulce Vida coral and peach arrangement", es: "Arreglo Dulce Vida coral y durazno" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["mixed", "pink"],
    active: true,
    seo: {
      title: { en: "Dulce Vida — Diva Flowers", es: "Dulce Vida — Diva Flowers" },
      description: {
        en: "Coral and peach housewarming arrangement. Same-day on Long Island.",
        es: "Arreglo coral y durazno para inauguraciones. Mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b1-13",
    slug: "dusky-bloom",
    title: { en: "Dusky Bloom", es: "Flor de Penumbra" },
    category: "bouquets",
    blurb: {
      en: "Mauve, plum, and smoke tones for the late-light hour.",
      es: "Malva, ciruela y humo para la hora de luz tardía.",
    },
    description: {
      en: "For the friend who orders the natural wine and means it — mauve roses, plum scabiosa, and smokebush, hand-tied moody and grown-up. Send it for the gallery opening she's pretending isn't a big deal. Order before 2pm for same-day delivery across Long Island; the bouquet from someone who knows her taste.",
      es: "Para la amiga que pide vino natural y de verdad le gusta — rosas malva, scabiosa ciruela y árbol del humo, atado a mano con aire de tarde y madurez. Mándalo por la apertura de la galería que está fingiendo que no le importa. Pídelo antes de las 2pm para entrega el mismo día en Long Island; el ramo de quien le conoce el gusto.",
    },
    images: [
      { src: "/products/dusky-bloom.jpg", alt: { en: "Dusky Bloom mauve and plum bouquet", es: "Ramo Flor de Penumbra malva y ciruela" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "congrats", "just-because"],
    colorFamily: ["mixed", "pink"],
    active: true,
    seo: {
      title: { en: "Dusky Bloom — Diva Flowers", es: "Flor de Penumbra — Diva Flowers" },
      description: {
        en: "Mauve and plum moody bouquet. Same-day delivery on Long Island.",
        es: "Ramo en malva y ciruela de tono profundo. Mismo día en Long Island.",
      },
    },
  },
  // ─── New catalog imports — Batch 2 (29) ─────────────────
  {
    id: "p-arr-b2-01",
    slug: "eclipse-garden",
    title: { en: "Eclipse Garden", es: "Jardín Eclipse" },
    category: "arrangements",
    blurb: {
      en: "Deep burgundy and inky plum for the one who likes drama with their florals.",
      es: "Borgoña profundo y ciruela tinta para quien prefiere el drama en sus flores.",
    },
    description: {
      en: "For the friend who wears black on a Saturday and means it — calla lilies, plum dahlias, and burgundy roses arranged with the kind of restraint that reads like confidence. Order before 2pm and we'll have it on her Long Island doorstep tonight. A gesture for the one who notices the details everyone else misses.",
      es: "Para la amiga que viste de negro un sábado y lo dice en serio — calas, dalias ciruela y rosas borgoña dispuestas con la contención que se lee como confianza. Pídelo antes de las 2pm y estará en su puerta de Long Island esta noche. Un gesto para quien nota los detalles que el resto pasa por alto.",
    },
    images: [
      { src: "/products/eclipse-garden.jpg", alt: { en: "Eclipse Garden arrangement in burgundy and plum", es: "Arreglo Jardín Eclipse en borgoña y ciruela" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["romance", "anniversary", "birthday", "just-because"],
    colorFamily: ["mixed", "red"],
    active: true,
    seo: {
      title: { en: "Eclipse Garden — Diva Flowers", es: "Jardín Eclipse — Diva Flowers" },
      description: {
        en: "Burgundy and plum arrangement with calla lilies and dahlias. Same-day Long Island delivery.",
        es: "Arreglo borgoña y ciruela con calas y dalias. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-02",
    slug: "encanto-pastel",
    title: { en: "Encanto Pastel", es: "Encanto Pastel" },
    category: "arrangements",
    blurb: {
      en: "Soft blush, butter yellow, and pale lavender for the abuela who still calls you mija.",
      es: "Rosa suave, mantequilla y lavanda pálida para la abuela que aún te llama mija.",
    },
    description: {
      en: "For the one who keeps the family stories in her kitchen — peonies, garden roses, and sweet pea in the kind of pastels that feel like a Sunday afternoon. Send it before 2pm and we'll have it at her Long Island door today. The arrangement that says you've been thinking about her all week.",
      es: "Para quien guarda las historias de la familia en su cocina — peonías, rosas de jardín y guisantes de olor en los pasteles que se sienten como una tarde de domingo. Envíalo antes de las 2pm y llega hoy a su puerta de Long Island. El arreglo que dice que has pensado en ella toda la semana.",
    },
    images: [
      { src: "/products/encanto-pastel.jpg", alt: { en: "Encanto Pastel arrangement in soft pastels", es: "Arreglo Encanto Pastel en pasteles suaves" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["pastel", "pink"],
    active: true,
    seo: {
      title: { en: "Encanto Pastel — Diva Flowers", es: "Encanto Pastel — Diva Flowers" },
      description: {
        en: "Pastel arrangement with peonies and garden roses. Same-day Long Island delivery.",
        es: "Arreglo pastel con peonías y rosas de jardín. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b2-01",
    slug: "ethereal-charm",
    title: { en: "Ethereal Charm", es: "Encanto Etéreo" },
    category: "bouquets",
    blurb: {
      en: "Whisper-white blooms and trailing greens for the romantic who reads poetry on purpose.",
      es: "Flores blancas susurrantes y verdes que caen para la romántica que lee poesía a propósito.",
    },
    description: {
      en: "For the one who keeps a journal and means it — white anemones, lisianthus, and silvery dusty miller wrapped soft enough to feel like an afterthought she'll think about all week. Order before 2pm and we'll deliver it across Long Island this afternoon. A bouquet for the slow burner who notices everything.",
      es: "Para quien lleva un diario y lo dice en serio — anémonas blancas, lisianthus y dusty miller plateado envueltos con la suavidad que se lee como un detalle que pensará toda la semana. Pídelo antes de las 2pm y entregamos por Long Island esta tarde. Un ramo para la que va despacio y nota todo.",
    },
    images: [
      { src: "/products/ethereal-charm.jpg", alt: { en: "Ethereal Charm bouquet in white and silver", es: "Ramo Encanto Etéreo en blanco y plata" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 10500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15000 },
    ],
    tags: ["new", "same-day"],
    occasions: ["romance", "just-because", "anniversary"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Ethereal Charm — Diva Flowers", es: "Encanto Etéreo — Diva Flowers" },
      description: {
        en: "White bouquet with anemones and lisianthus. Same-day Long Island delivery.",
        es: "Ramo blanco con anémonas y lisianthus. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-pla-b2-01",
    slug: "evergreen-horizon",
    title: { en: "Evergreen Horizon", es: "Horizonte Verde" },
    category: "plants",
    blurb: {
      en: "A layered planter of trailing pothos and fern for the friend rebuilding her apartment.",
      es: "Un planter en capas de potos y helechos para la amiga que rearma su apartamento.",
    },
    description: {
      en: "For the one starting fresh — trailing pothos, Boston fern, and a velvety calathea potted together to feel like the corner of the living room she'll actually want to sit in. Send it before 2pm and we'll have it on her Long Island doorstep this afternoon. The housewarming that keeps growing after you leave.",
      es: "Para quien empieza de nuevo — potos colgante, helecho de Boston y una calathea aterciopelada plantadas juntas como el rincón de la sala donde de verdad querrá sentarse. Envíalo antes de las 2pm y llega esta tarde a su puerta de Long Island. El regalo de bienvenida que sigue creciendo cuando te vas.",
    },
    images: [
      { src: "/products/evergreen-horizon.jpg", alt: { en: "Evergreen Horizon layered plant arrangement", es: "Planter Horizonte Verde en capas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "petite", label: { en: "Petite", es: "Pequeño" }, priceCents: 7500 },
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 11000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Evergreen Horizon — Diva Flowers", es: "Horizonte Verde — Diva Flowers" },
      description: {
        en: "Layered planter with pothos, fern, and calathea. Same-day Long Island delivery.",
        es: "Planter en capas con potos, helecho y calathea. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-03",
    slug: "eye-candy",
    title: { en: "Eye Candy", es: "Eye Candy" },
    category: "arrangements",
    blurb: {
      en: "Hot pink, tangerine, and coral packed tight for the one who lives loud on purpose.",
      es: "Rosa intenso, mandarina y coral apretados para quien vive en alto a propósito.",
    },
    description: {
      en: "For the friend who texts in all caps and means it — gerbera, hot pink roses, and tangerine ranunculus packed dense enough to make her coffee table the loudest in the room. Order before 2pm and we'll have it across Long Island today. The arrangement for someone who already knows she's the main character.",
      es: "Para la amiga que escribe en mayúsculas y lo dice en serio — gerberas, rosas rosa intenso y ranúnculos mandarina apretados como para que su mesa sea la más ruidosa del cuarto. Pídelo antes de las 2pm y llega hoy por Long Island. El arreglo para quien ya sabe que es la protagonista.",
    },
    images: [
      { src: "/products/eye-candy.jpg", alt: { en: "Eye Candy arrangement in hot pink and tangerine", es: "Arreglo Eye Candy en rosa intenso y mandarina" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Eye Candy — Diva Flowers", es: "Eye Candy — Diva Flowers" },
      description: {
        en: "Hot pink and tangerine arrangement with gerbera and ranunculus. Same-day Long Island delivery.",
        es: "Arreglo rosa intenso y mandarina con gerberas y ranúnculos. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-04",
    slug: "falling-leaves",
    title: { en: "Falling Leaves", es: "Hojas que Caen" },
    category: "arrangements",
    blurb: {
      en: "Rust roses and amber chrysanthemums for the host who already lit the candle.",
      es: "Rosas óxido y crisantemos ámbar para el anfitrión que ya prendió la vela.",
    },
    description: {
      en: "For the one who sets the table for everyone — rust garden roses, amber chrysanthemums, and copper foliage gathered like the last walk through the park before the cold settles in. Send it before 2pm and we'll deliver it across Long Island this afternoon. The centerpiece that makes Sunday dinner feel like a holiday.",
      es: "Para quien pone la mesa para todos — rosas de jardín óxido, crisantemos ámbar y follaje cobrizo reunidos como el último paseo por el parque antes del frío. Envíalo antes de las 2pm y entregamos por Long Island esta tarde. El centro de mesa que vuelve la cena del domingo en algo de fiesta.",
    },
    images: [
      { src: "/products/falling-leaves.jpg", alt: { en: "Falling Leaves autumn arrangement in rust and amber", es: "Arreglo otoñal Hojas que Caen en óxido y ámbar" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "seasonal", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Falling Leaves — Diva Flowers", es: "Hojas que Caen — Diva Flowers" },
      description: {
        en: "Autumn arrangement with rust roses and amber mums. Same-day Long Island delivery.",
        es: "Arreglo otoñal con rosas óxido y crisantemos ámbar. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-05",
    slug: "farmhouse-fresh",
    title: { en: "Farmhouse Fresh", es: "Fresco de Granja" },
    category: "arrangements",
    blurb: {
      en: "White hydrangea and field greens in a stoneware crock for the one who keeps it grounded.",
      es: "Hortensia blanca y verdes de campo en jarra de gres para quien mantiene los pies en la tierra.",
    },
    description: {
      en: "For the one whose kitchen smells like coffee and lemon at the same time — cream hydrangea, white stock, and herby greens settled into stoneware like they grew there. Order before 2pm and we'll have it on her Long Island doorstep today. A gesture for the friend who makes everyone feel at home.",
      es: "Para quien tiene la cocina con olor a café y limón a la vez — hortensia crema, alelí blanco y verdes con notas herbales acomodados en gres como si hubieran crecido ahí. Pídelo antes de las 2pm y llega hoy a su puerta de Long Island. Un gesto para la amiga que hace que todos se sientan en casa.",
    },
    images: [
      { src: "/products/farmhouse-fresh.jpg", alt: { en: "Farmhouse Fresh arrangement with hydrangea in stoneware", es: "Arreglo Fresco de Granja con hortensia en gres" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "congrats"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Farmhouse Fresh — Diva Flowers", es: "Fresco de Granja — Diva Flowers" },
      description: {
        en: "White hydrangea arrangement in stoneware. Same-day Long Island delivery.",
        es: "Arreglo de hortensia blanca en gres. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-06",
    slug: "flamingo-garden",
    title: { en: "Flamingo Garden", es: "Jardín Flamenco" },
    category: "arrangements",
    blurb: {
      en: "Coral roses and pink ginger for the one who keeps a beach bag in her trunk year-round.",
      es: "Rosas coral y jengibre rosa para la que tiene la bolsa de playa en el carro todo el año.",
    },
    description: {
      en: "For the friend who plans the trip before anyone else commits — coral roses, pink ginger, and protea arranged with the heat of an afternoon you didn't want to end. Send it before 2pm and we'll have it across Long Island today. The arrangement for the one who knows where the good light is.",
      es: "Para la amiga que planea el viaje antes de que nadie se anime — rosas coral, jengibre rosa y protea con el calor de una tarde que no querías que terminara. Envíalo antes de las 2pm y llega hoy por Long Island. El arreglo para quien ya sabe dónde queda la mejor luz.",
    },
    images: [
      { src: "/products/flamingo-garden.jpg", alt: { en: "Flamingo Garden tropical arrangement in coral and pink", es: "Arreglo tropical Jardín Flamenco en coral y rosa" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17000 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Flamingo Garden — Diva Flowers", es: "Jardín Flamenco — Diva Flowers" },
      description: {
        en: "Tropical arrangement with coral roses and pink ginger. Same-day Long Island delivery.",
        es: "Arreglo tropical con rosas coral y jengibre rosa. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-07",
    slug: "floral-fiesta",
    title: { en: "Floral Fiesta", es: "Fiesta Floral" },
    category: "arrangements",
    blurb: {
      en: "Magenta, marigold, and lime — for the friend whose playlist runs the party.",
      es: "Magenta, cempasúchil y lima — para la amiga cuya playlist manda en la fiesta.",
    },
    description: {
      en: "For the one who turns a Wednesday into something the group still talks about — fuchsia roses, marigold, and lime cymbidium gathered loud and on purpose. Order before 2pm and we'll have it on her Long Island doorstep this afternoon. The bouquet for the friend who makes the room before she walks in.",
      es: "Para la que vuelve un miércoles en algo que el grupo sigue contando — rosas fucsia, cempasúchil y cymbidium lima reunidos a todo volumen y a propósito. Pídelo antes de las 2pm y llega esta tarde a su puerta de Long Island. El ramo para la amiga que arma el cuarto antes de entrar.",
    },
    images: [
      { src: "/products/floral-fiesta.jpg", alt: { en: "Floral Fiesta arrangement in magenta and marigold", es: "Arreglo Fiesta Floral en magenta y cempasúchil" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "congrats", "just-because"],
    colorFamily: ["mixed", "pink"],
    active: true,
    seo: {
      title: { en: "Floral Fiesta — Diva Flowers", es: "Fiesta Floral — Diva Flowers" },
      description: {
        en: "Bold arrangement with fuchsia roses and marigold. Same-day Long Island delivery.",
        es: "Arreglo intenso con rosas fucsia y cempasúchil. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b2-02",
    slug: "flores-dulces",
    title: { en: "Flores Dulces", es: "Flores Dulces" },
    category: "bouquets",
    blurb: {
      en: "Cotton candy roses and sweet pea for the one who still gets giddy about flowers.",
      es: "Rosas algodón de azúcar y guisantes de olor para la que aún se emociona con las flores.",
    },
    description: {
      en: "For the friend who saves the wrapping paper — pink garden roses, sweet pea, and lavender stock wrapped soft like a Saturday morning that wasn't going anywhere fast. Send it before 2pm and we'll have it at her Long Island door today. The bouquet for the one who reminds you joy doesn't have to be earned.",
      es: "Para la amiga que guarda el papel de envolver — rosas de jardín rosadas, guisantes de olor y alelí lavanda envueltos suave como un sábado en la mañana que no tenía prisa. Envíalo antes de las 2pm y llega hoy a su puerta de Long Island. El ramo para quien te recuerda que la alegría no se gana, se recibe.",
    },
    images: [
      { src: "/products/flores-dulces.jpg", alt: { en: "Flores Dulces bouquet in pink and lavender", es: "Ramo Flores Dulces en rosa y lavanda" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 10500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15000 },
    ],
    tags: ["new", "same-day"],
    occasions: ["romance", "anniversary", "birthday", "just-because"],
    colorFamily: ["pink", "pastel"],
    active: true,
    seo: {
      title: { en: "Flores Dulces — Diva Flowers", es: "Flores Dulces — Diva Flowers" },
      description: {
        en: "Soft pink bouquet with garden roses and sweet pea. Same-day Long Island delivery.",
        es: "Ramo rosa suave con rosas de jardín y guisantes de olor. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b2-03",
    slug: "flower-pop",
    title: { en: "Flower Pop", es: "Flower Pop" },
    category: "bouquets",
    blurb: {
      en: "Candy-bright daisies and gerbera for the friend who answers texts in seconds.",
      es: "Margaritas y gerberas brillantes para la amiga que responde mensajes en segundos.",
    },
    description: {
      en: "For the one who shows up first and stays last — yellow gerbera, hot pink daisies, and orange mini roses bunched like the best part of someone's day. Order before 2pm and we'll have it on her Long Island doorstep this afternoon. A bouquet for the friend who deserves the kind of mail that isn't a bill.",
      es: "Para quien llega primero y se queda hasta el final — gerberas amarillas, margaritas rosa intenso y mini rosas naranjas reunidas como la mejor parte del día. Pídelo antes de las 2pm y llega esta tarde a su puerta de Long Island. Un ramo para la amiga que merece correspondencia que no sea una factura.",
    },
    images: [
      { src: "/products/flower-pop.jpg", alt: { en: "Flower Pop colorful bouquet with gerbera and daisies", es: "Ramo Flower Pop colorido con gerberas y margaritas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 6500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 10000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 14500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Flower Pop — Diva Flowers", es: "Flower Pop — Diva Flowers" },
      description: {
        en: "Bright bouquet with gerbera and daisies. Same-day Long Island delivery.",
        es: "Ramo brillante con gerberas y margaritas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-gif-b2-01",
    slug: "gather-give",
    title: { en: "Gather & Give", es: "Reunir y Regalar" },
    category: "gifts",
    blurb: {
      en: "A market basket of blooms, honey, and sweets for the host who feeds everyone.",
      es: "Una canasta de mercado con flores, miel y dulces para la anfitriona que alimenta a todos.",
    },
    description: {
      en: "For the one who never lets you leave hungry — a woven basket layered with seasonal blooms, local honey, sea salt chocolate, and shortbread, ready to set down and unpack together. Send it before 2pm and we'll have it across Long Island today. The thank-you that doubles as the next thing to share.",
      es: "Para quien nunca te deja salir con hambre — una canasta de mimbre con flores de temporada, miel local, chocolate con sal de mar y shortbread, lista para abrir y compartir. Envíalo antes de las 2pm y llega hoy por Long Island. El gracias que también es lo próximo que se comparte.",
    },
    images: [
      { src: "/products/gather-give.jpg", alt: { en: "Gather & Give market basket with blooms and treats", es: "Canasta Reunir y Regalar con flores y golosinas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17000 },
    ],
    addOns: [
      { id: "card", label: { en: "Handwritten card", es: "Tarjeta escrita a mano" }, priceCents: 500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "congrats", "birthday", "get-well"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Gather & Give — Diva Flowers", es: "Reunir y Regalar — Diva Flowers" },
      description: {
        en: "Market basket with seasonal blooms and local treats. Same-day Long Island delivery.",
        es: "Canasta con flores de temporada y golosinas locales. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b2-04",
    slug: "golden-hour",
    title: { en: "Golden Hour", es: "Hora Dorada" },
    category: "bouquets",
    blurb: {
      en: "Sunset-tone roses and ranunculus for the friend who deserves a Tuesday surprise.",
      es: "Rosas y ranúnculos en tonos de atardecer para la amiga que merece la sorpresa de un martes.",
    },
    description: {
      en: "For the one who turns ordinary days into stories worth retelling — peach roses, copper ranunculus, and butterscotch tulips wrapped to feel like the last warm light before evening. Send it before 2pm and we'll have it at her Long Island door this afternoon. A small gesture that lands bigger than expected.",
      es: "Para quien convierte días corrientes en historias dignas de contar — rosas durazno, ranúnculos cobrizos y tulipanes caramelo, envueltos como la última luz tibia antes de la noche. Envíalo antes de las 2pm y estará en su puerta de Long Island esta tarde. El gesto pequeño que llega más lejos de lo esperado.",
    },
    images: [
      { src: "/products/golden-hour.jpg", alt: { en: "Golden Hour bouquet in sunset tones", es: "Ramo Hora Dorada en tonos de atardecer" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["mixed", "pastel"],
    active: true,
    seo: {
      title: { en: "Golden Hour — Diva Flowers", es: "Hora Dorada — Diva Flowers" },
      description: {
        en: "Sunset-tone bouquet with peach roses and copper ranunculus. Same-day Long Island delivery.",
        es: "Ramo en tonos de atardecer con rosas durazno y ranúnculos cobrizos. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-08",
    slug: "hundred-roses-basket",
    title: { en: "Hundred Roses Basket", es: "Canasta de Cien Rosas" },
    category: "arrangements",
    blurb: {
      en: "One hundred roses in a low woven basket — for the anniversary that earns a number.",
      es: "Cien rosas en una canasta baja — para el aniversario que ya tiene número.",
    },
    description: {
      en: "For the one who's been counting the years and isn't done — a hundred long-stem roses arranged dense and low in a hand-woven basket, the kind of gesture that makes the whole house quiet for a second. Book the anniversary they'll remember and we'll deliver it across Long Island today if you order before 2pm. The flowers for the milestone you don't undersell.",
      es: "Para quien lleva los años contados y no termina — cien rosas de tallo largo dispuestas densas y bajas en canasta tejida a mano, el gesto que vuelve la casa silenciosa por un segundo. Reserva el aniversario que recordarán y entregamos hoy por Long Island si pides antes de las 2pm. Las flores para el hito que no se queda corto.",
    },
    images: [
      { src: "/products/hundred-roses-basket.png", alt: { en: "Hundred Roses Basket with long-stem red roses", es: "Canasta de Cien Rosas con rosas rojas de tallo largo" }, aspect: "4/5" },
    ],
    variants: [
      { id: "red", label: { en: "Red", es: "Rojas" }, priceCents: 32500 },
      { id: "blush", label: { en: "Blush", es: "Rosadas" }, priceCents: 32500 },
      { id: "mixed", label: { en: "Mixed", es: "Mixtas" }, priceCents: 35000 },
    ],
    addOns: [
      { id: "card", label: { en: "Handwritten card", es: "Tarjeta escrita a mano" }, priceCents: 500 },
      { id: "champagne", label: { en: "Champagne pairing", es: "Maridaje de champaña" }, priceCents: 6500 },
    ],
    tags: ["staff-pick", "same-day"],
    occasions: ["anniversary", "romance"],
    colorFamily: ["red", "pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Hundred Roses Basket — Diva Flowers", es: "Canasta de Cien Rosas — Diva Flowers" },
      description: {
        en: "One hundred long-stem roses in a hand-woven basket. Same-day Long Island delivery.",
        es: "Cien rosas de tallo largo en canasta tejida a mano. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-09",
    slug: "jade-lavender",
    title: { en: "Jade & Lavender", es: "Jade y Lavanda" },
    category: "arrangements",
    blurb: {
      en: "Pale jade hydrangea and lavender stock for the friend who collects calm on purpose.",
      es: "Hortensia jade y alelí lavanda para la amiga que colecciona calma a propósito.",
    },
    description: {
      en: "For the one who lights the candle before she sits down — pale jade hydrangea, lavender stock, and silver eucalyptus arranged with the kind of quiet that makes a room exhale. Order before 2pm and we'll have it on her Long Island doorstep today. The arrangement for the friend who's teaching you to slow down.",
      es: "Para quien prende la vela antes de sentarse — hortensia jade, alelí lavanda y eucalipto plateado dispuestos con la calma que hace exhalar a un cuarto. Pídelo antes de las 2pm y llega hoy a su puerta de Long Island. El arreglo para la amiga que te enseña a ir más lento.",
    },
    images: [
      { src: "/products/jade-lavender.jpg", alt: { en: "Jade & Lavender arrangement in pale green and lavender", es: "Arreglo Jade y Lavanda en verde pálido y lavanda" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16000 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["green", "pastel"],
    active: true,
    seo: {
      title: { en: "Jade & Lavender — Diva Flowers", es: "Jade y Lavanda — Diva Flowers" },
      description: {
        en: "Calming arrangement with jade hydrangea and lavender stock. Same-day Long Island delivery.",
        es: "Arreglo sereno con hortensia jade y alelí lavanda. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-10",
    slug: "jungle-jewels",
    title: { en: "Jungle Jewels", es: "Joyas de la Selva" },
    category: "arrangements",
    blurb: {
      en: "Emerald foliage and jewel-tone orchids for the friend with a passport always packed.",
      es: "Follaje esmeralda y orquídeas joya para la amiga con el pasaporte siempre listo.",
    },
    description: {
      en: "For the one who books the flight first and explains later — cymbidium orchids, anthurium, and monstera leaf staged like the kind of room you'd want to sit in until the rain stops. Send it before 2pm and we'll have it across Long Island today. The arrangement for someone who treats every Tuesday like a small expedition.",
      es: "Para quien reserva el vuelo primero y explica después — orquídeas cymbidium, anturio y hoja de monstera dispuestas como el cuarto donde te quedarías hasta que pare la lluvia. Envíalo antes de las 2pm y llega hoy por Long Island. El arreglo para quien convierte cada martes en pequeña expedición.",
    },
    images: [
      { src: "/products/jungle-jewels.jpg", alt: { en: "Jungle Jewels tropical arrangement with orchids and monstera", es: "Arreglo tropical Joyas de la Selva con orquídeas y monstera" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 18500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["just-because", "birthday", "congrats"],
    colorFamily: ["green", "mixed"],
    active: true,
    seo: {
      title: { en: "Jungle Jewels — Diva Flowers", es: "Joyas de la Selva — Diva Flowers" },
      description: {
        en: "Tropical arrangement with cymbidium orchids and monstera. Same-day Long Island delivery.",
        es: "Arreglo tropical con orquídeas cymbidium y monstera. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-11",
    slug: "jungle-whirl",
    title: { en: "Jungle Whirl", es: "Remolino de Selva" },
    category: "arrangements",
    blurb: {
      en: "Spiraled tropical foliage and bright heliconia for the one who lives in motion.",
      es: "Follaje tropical en espiral y heliconia brillante para quien vive en movimiento.",
    },
    description: {
      en: "For the friend who never finishes the same coffee twice — heliconia, ginger, and spiraling tropical leaves arranged with the energy of a song you can't sit still through. Order before 2pm and we'll have it on her Long Island doorstep today. The arrangement for the one always halfway out the door, and grateful for it.",
      es: "Para la amiga que nunca termina el mismo café dos veces — heliconia, jengibre y hojas tropicales en espiral con la energía de una canción que no te deja quieto. Pídelo antes de las 2pm y llega hoy a su puerta de Long Island. El arreglo para la que siempre va saliendo, y se alegra de eso.",
    },
    images: [
      { src: "/products/jungle-whirl.jpg", alt: { en: "Jungle Whirl tropical arrangement with heliconia", es: "Arreglo tropical Remolino de Selva con heliconia" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because"],
    colorFamily: ["mixed", "green"],
    active: true,
    seo: {
      title: { en: "Jungle Whirl — Diva Flowers", es: "Remolino de Selva — Diva Flowers" },
      description: {
        en: "Tropical arrangement with heliconia and ginger. Same-day Long Island delivery.",
        es: "Arreglo tropical con heliconia y jengibre. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-gif-b2-02",
    slug: "lilac-breeze-basket",
    title: { en: "Lilac Breeze Basket", es: "Canasta Brisa de Lila" },
    category: "gifts",
    blurb: {
      en: "Lilac-toned blooms in a soft basket for the one who just needs a soft afternoon.",
      es: "Flores lavanda en canasta suave para quien necesita una tarde tranquila.",
    },
    description: {
      en: "For the friend who's been holding everyone up — lilac stock, lavender roses, and white sweet pea tucked into a soft-handled basket like a quiet permission to rest. Send it before 2pm and we'll have it on her Long Island doorstep today. The arrangement for the one who deserves to be on the receiving end this week.",
      es: "Para la amiga que ha sostenido a todos — alelí lila, rosas lavanda y guisantes de olor blancos en canasta de asas suaves, como un permiso silencioso de descansar. Envíalo antes de las 2pm y llega hoy a su puerta de Long Island. El arreglo para quien esta semana merece estar del lado que recibe.",
    },
    images: [
      { src: "/products/lilac-breeze-basket.jpg", alt: { en: "Lilac Breeze Basket with lilac and lavender blooms", es: "Canasta Brisa de Lila con flores lila y lavanda" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday", "get-well", "sympathy"],
    colorFamily: ["pastel", "white"],
    active: true,
    seo: {
      title: { en: "Lilac Breeze Basket — Diva Flowers", es: "Canasta Brisa de Lila — Diva Flowers" },
      description: {
        en: "Lilac-toned basket with stock and lavender roses. Same-day Long Island delivery.",
        es: "Canasta lila con alelí y rosas lavanda. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-sym-b2-01",
    slug: "lilies-for-lottie",
    title: { en: "Lilies for Lottie", es: "Lirios para Lottie" },
    category: "arrangements",
    blurb: {
      en: "White lilies and soft greens — the quiet presence a hard week needs.",
      es: "Lirios blancos y verdes suaves — la presencia callada que pide una semana dura.",
    },
    description: {
      en: "For the family holding each other up — white oriental lilies, ivory roses, and soft eucalyptus arranged with the kind of dignity that doesn't try to fill the silence. We deliver across Long Island the same day when you order before 2pm, and we know how to leave it gently. The flowers that say I'm here without asking anyone to perform.",
      es: "Para la familia que se sostiene mutuamente — lirios orientales blancos, rosas marfil y eucalipto suave dispuestos con una dignidad que no intenta llenar el silencio. Entregamos por Long Island el mismo día si pides antes de las 2pm, y sabemos cómo dejarlo con cuidado. Las flores que dicen estoy aquí sin pedirle a nadie que actúe.",
    },
    images: [
      { src: "/products/lilies-for-lottie.jpg", alt: { en: "Lilies for Lottie sympathy arrangement in white", es: "Arreglo de condolencias Lirios para Lottie en blanco" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 10500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["same-day"],
    occasions: ["sympathy"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Lilies for Lottie — Diva Flowers", es: "Lirios para Lottie — Diva Flowers" },
      description: {
        en: "Sympathy arrangement with white oriental lilies. Same-day Long Island delivery.",
        es: "Arreglo de condolencias con lirios orientales blancos. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-12",
    slug: "lush-horizons",
    title: { en: "Lush Horizons", es: "Horizontes Frondosos" },
    category: "arrangements",
    blurb: {
      en: "Garden-style abundance in greens and creams for the one who hosts on a Sunday.",
      es: "Abundancia estilo jardín en verdes y crema para quien recibe los domingos.",
    },
    description: {
      en: "For the host who already moved the furniture — cream garden roses, green hydrangea, and trailing eucalyptus arranged loose enough to feel like it grew on the table. Order before 2pm and we'll have it across Long Island today. The centerpiece for the friend who makes a Sunday afternoon feel like the place to be.",
      es: "Para la anfitriona que ya movió los muebles — rosas de jardín crema, hortensia verde y eucalipto colgante dispuestos sueltos como si hubieran crecido sobre la mesa. Pídelo antes de las 2pm y llega hoy por Long Island. El centro de mesa para la amiga que vuelve un domingo en tarde el plan a seguir.",
    },
    images: [
      { src: "/products/lush-horizons.jpg", alt: { en: "Lush Horizons garden-style arrangement in green and cream", es: "Arreglo estilo jardín Horizontes Frondosos en verde y crema" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["romance", "anniversary", "congrats", "just-because"],
    colorFamily: ["green", "white"],
    active: true,
    seo: {
      title: { en: "Lush Horizons — Diva Flowers", es: "Horizontes Frondosos — Diva Flowers" },
      description: {
        en: "Garden-style arrangement with green hydrangea and cream roses. Same-day Long Island delivery.",
        es: "Arreglo estilo jardín con hortensia verde y rosas crema. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-13",
    slug: "luz-del-caribe",
    title: { en: "Luz del Caribe", es: "Luz del Caribe" },
    category: "arrangements",
    blurb: {
      en: "Tropical brights and palm fronds for the one who turned the kitchen into salsa night.",
      es: "Brillantes tropicales y palmas para quien convirtió la cocina en noche de salsa.",
    },
    description: {
      en: "For the friend whose laugh you can pick out of a crowd — heliconia, yellow ginger, and orange birds-of-paradise arranged loud, warm, and a little proud of itself. Send it before 2pm and we'll have it across Long Island today. The arrangement for the one who reminds you the music's better when you turn it up.",
      es: "Para la amiga cuya risa reconoces entre todos — heliconia, jengibre amarillo y aves del paraíso naranjas dispuestas a todo volumen, cálidas y un poco orgullosas. Envíalo antes de las 2pm y llega hoy por Long Island. El arreglo para quien te recuerda que la música suena mejor más alta.",
    },
    images: [
      { src: "/products/luz-del-caribe.jpg", alt: { en: "Luz del Caribe tropical arrangement in bright Caribbean tones", es: "Arreglo tropical Luz del Caribe en tonos caribeños" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Luz del Caribe — Diva Flowers", es: "Luz del Caribe — Diva Flowers" },
      description: {
        en: "Tropical arrangement with heliconia and birds-of-paradise. Same-day Long Island delivery.",
        es: "Arreglo tropical con heliconia y aves del paraíso. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-14",
    slug: "magenta-majesty",
    title: { en: "Magenta Majesty", es: "Majestad Magenta" },
    category: "arrangements",
    blurb: {
      en: "Deep magenta peonies and orchids for the one who walks in and changes the temperature.",
      es: "Peonías magenta profundo y orquídeas para quien entra y cambia la temperatura del cuarto.",
    },
    description: {
      en: "For the woman who already knows the answer — magenta peonies, fuchsia phalaenopsis, and burgundy calla lilies arranged with the kind of confidence that doesn't ask permission. Order before 2pm and we'll have it on her Long Island doorstep today. The arrangement for the one who treats her own birthday like a holiday for everyone else.",
      es: "Para la mujer que ya sabe la respuesta — peonías magenta, phalaenopsis fucsia y calas borgoña dispuestas con la confianza que no pide permiso. Pídelo antes de las 2pm y llega hoy a su puerta de Long Island. El arreglo para la que vuelve su cumpleaños en feriado para los demás.",
    },
    images: [
      { src: "/products/magenta-majesty.jpg", alt: { en: "Magenta Majesty arrangement with magenta peonies and orchids", es: "Arreglo Majestad Magenta con peonías magenta y orquídeas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 19500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["birthday", "anniversary", "romance"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Magenta Majesty — Diva Flowers", es: "Majestad Magenta — Diva Flowers" },
      description: {
        en: "Bold magenta arrangement with peonies and orchids. Same-day Long Island delivery.",
        es: "Arreglo magenta intenso con peonías y orquídeas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-15",
    slug: "maison-de-diva",
    title: { en: "Maison de Diva", es: "Maison de Diva" },
    category: "arrangements",
    blurb: {
      en: "Our signature couture arrangement — for the recipient who already has the rest.",
      es: "Nuestro arreglo couture insignia — para quien ya tiene todo lo demás.",
    },
    description: {
      en: "For the one who decorates the room and remembers the names — phalaenopsis orchids, French roses, ranunculus, and trailing jasmine staged with the precision of a Madison Avenue window. Book the arrangement they'll talk about and we'll deliver across Long Island today if you order before 2pm. The piece for the recipient who notices what no one else points out.",
      es: "Para quien decora el cuarto y recuerda los nombres — orquídeas phalaenopsis, rosas francesas, ranúnculos y jazmín colgante dispuestos con la precisión de una vitrina de Madison Avenue. Reserva el arreglo del que hablarán y entregamos hoy por Long Island si pides antes de las 2pm. La pieza para quien nota lo que nadie más señala.",
    },
    images: [
      { src: "/products/maison-de-diva.jpg", alt: { en: "Maison de Diva signature couture arrangement", es: "Arreglo couture insignia Maison de Diva" }, aspect: "4/5" },
    ],
    variants: [
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 22500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 32500 },
      { id: "couture", label: { en: "Couture", es: "Couture" }, priceCents: 45000 },
    ],
    addOns: [
      { id: "card", label: { en: "Handwritten card", es: "Tarjeta escrita a mano" }, priceCents: 500 },
      { id: "champagne", label: { en: "Champagne pairing", es: "Maridaje de champaña" }, priceCents: 8500 },
    ],
    tags: ["staff-pick", "same-day"],
    occasions: ["anniversary", "romance", "congrats"],
    colorFamily: ["white", "pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Maison de Diva — Diva Flowers", es: "Maison de Diva — Diva Flowers" },
      description: {
        en: "Signature couture arrangement with phalaenopsis and French roses. Same-day Long Island delivery.",
        es: "Arreglo couture insignia con phalaenopsis y rosas francesas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-16",
    slug: "mango-tango",
    title: { en: "Mango Tango", es: "Mango Tango" },
    category: "arrangements",
    blurb: {
      en: "Mango orange and watermelon pink for the friend who's already dancing in the kitchen.",
      es: "Naranja mango y rosa sandía para la amiga que ya baila en la cocina.",
    },
    description: {
      en: "For the one who turns up the music before pouring the coffee — mango roses, watermelon ranunculus, and sunshine craspedia gathered with the kind of nerve a Friday night earns. Send it before 2pm and we'll have it across Long Island today. The arrangement for the friend who treats Wednesdays like weekends.",
      es: "Para quien sube la música antes de servir el café — rosas mango, ranúnculos sandía y craspedia sol reunidos con el atrevimiento que se gana un viernes en la noche. Envíalo antes de las 2pm y llega hoy por Long Island. El arreglo para la amiga que trata los miércoles como fin de semana.",
    },
    images: [
      { src: "/products/mango-tango.jpg", alt: { en: "Mango Tango arrangement in mango orange and watermelon pink", es: "Arreglo Mango Tango en naranja mango y rosa sandía" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because", "congrats", "mothers-day"],
    colorFamily: ["mixed", "pink"],
    active: true,
    seo: {
      title: { en: "Mango Tango — Diva Flowers", es: "Mango Tango — Diva Flowers" },
      description: {
        en: "Bright arrangement with mango roses and watermelon ranunculus. Same-day Long Island delivery.",
        es: "Arreglo brillante con rosas mango y ranúnculos sandía. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-17",
    slug: "midsomar",
    title: { en: "Midsomar", es: "Midsomar" },
    category: "arrangements",
    blurb: {
      en: "Garden daisies, chamomile, and white lupine for the one who lives near a window.",
      es: "Margaritas, manzanilla y lupinos blancos para quien vive cerca de una ventana.",
    },
    description: {
      en: "For the friend who keeps the windows open in June — Shasta daisies, chamomile, white lupine, and trailing grasses arranged like a meadow at the brightest hour of the longest day. Order before 2pm and we'll have it on her Long Island doorstep this afternoon. A summer gesture for the one who already knows where the sun lands at four.",
      es: "Para la amiga que deja las ventanas abiertas en junio — margaritas Shasta, manzanilla, lupinos blancos y pastos colgantes dispuestos como un prado en la hora más clara del día más largo. Pídelo antes de las 2pm y llega esta tarde a su puerta de Long Island. Un gesto de verano para quien ya sabe dónde cae el sol a las cuatro.",
    },
    images: [
      { src: "/products/midsomar.jpg", alt: { en: "Midsomar meadow-style arrangement in white", es: "Arreglo estilo prado Midsomar en blanco" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "seasonal", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Midsomar — Diva Flowers", es: "Midsomar — Diva Flowers" },
      description: {
        en: "Meadow-style arrangement with Shasta daisies and chamomile. Same-day Long Island delivery.",
        es: "Arreglo estilo prado con margaritas Shasta y manzanilla. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-pla-b2-02",
    slug: "monstera-mood",
    title: { en: "Monstera Mood", es: "Estado Monstera" },
    category: "sympathy",
    blurb: {
      en: "A statement monstera in a hand-thrown pot for the friend rebuilding the corner.",
      es: "Una monstera de presencia en maceta artesanal para la amiga que rearma el rincón.",
    },
    description: {
      en: "For the one finally making the apartment hers — a sculptural monstera in a hand-thrown matte pot, ready to anchor the corner she's been staring at all month. Send it before 2pm and we'll have it on her Long Island doorstep today. The kind of plant gift that becomes part of how she remembers this season.",
      es: "Para quien por fin hace suyo el apartamento — una monstera escultural en maceta mate hecha a mano, lista para anclar el rincón que lleva un mes mirando. Envíalo antes de las 2pm y llega hoy a su puerta de Long Island. La planta que se convierte en parte de cómo recordará esta temporada.",
    },
    images: [
      { src: "/products/monstera-mood.jpg", alt: { en: "Monstera Mood sculptural plant in matte pot", es: "Planta Estado Monstera escultural en maceta mate" }, aspect: "4/5" },
    ],
    variants: [
      { id: "petite", label: { en: "Petite", es: "Pequeña" }, priceCents: 8500 },
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 12500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["sympathy", "congrats", "just-because", "birthday"],
    colorFamily: ["green"],
    active: true,
    seo: {
      title: { en: "Monstera Mood — Diva Flowers", es: "Estado Monstera — Diva Flowers" },
      description: {
        en: "Sculptural monstera plant in a hand-thrown pot. Same-day Long Island delivery.",
        es: "Monstera escultural en maceta artesanal. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-sym-b2-02",
    slug: "natures-cornucopia",
    title: { en: "Nature's Cornucopia", es: "Cornucopia de la Naturaleza" },
    category: "arrangements",
    blurb: {
      en: "Earth-toned blooms and gathered branches for the family that's been holding it together.",
      es: "Flores en tonos tierra y ramas reunidas para la familia que ha estado sosteniéndolo todo.",
    },
    description: {
      en: "For the home where everyone gathers — bronze chrysanthemums, ivory roses, and seasonal branches arranged generous and grounded, the kind of gesture that says we know this week has been long. We deliver across Long Island the same day when you order before 2pm. The arrangement for relatives who don't need words, just presence.",
      es: "Para la casa donde todos se reúnen — crisantemos bronce, rosas marfil y ramas de temporada dispuestas generosas y firmes, el gesto que dice sabemos que la semana ha sido larga. Entregamos por Long Island el mismo día si pides antes de las 2pm. El arreglo para los familiares que no necesitan palabras, solo presencia.",
    },
    images: [
      { src: "/products/natures-cornucopia.jpg", alt: { en: "Nature's Cornucopia sympathy arrangement in earth tones", es: "Arreglo de condolencias Cornucopia de la Naturaleza en tonos tierra" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 11500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["same-day", "seasonal"],
    occasions: ["sympathy"],
    colorFamily: ["mixed", "white"],
    active: true,
    seasonMonths: [9, 10, 11],
    seo: {
      title: { en: "Nature's Cornucopia — Diva Flowers", es: "Cornucopia de la Naturaleza — Diva Flowers" },
      description: {
        en: "Sympathy arrangement in earth tones with bronze mums. Same-day Long Island delivery.",
        es: "Arreglo de condolencias en tonos tierra con crisantemos bronce. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b2-18",
    slug: "neon-tropic",
    title: { en: "Neon Tropic", es: "Neón Tropical" },
    category: "arrangements",
    blurb: {
      en: "Electric pinks and acid greens for the one who throws the after-party.",
      es: "Rosas eléctricos y verdes ácidos para quien arma la afterparty.",
    },
    description: {
      en: "For the friend who makes the playlist and the rules — neon pink anthurium, lime cymbidium, and electric ginger arranged with the brightness of a club door opening at midnight. Order before 2pm and we'll have it across Long Island today. The arrangement for the one whose group chat is louder than the actual party.",
      es: "Para la amiga que arma la playlist y las reglas — anturio rosa neón, cymbidium lima y jengibre eléctrico dispuestos con el brillo de la puerta de un club abriendo a medianoche. Pídelo antes de las 2pm y llega hoy por Long Island. El arreglo para quien tiene el grupo de chat más ruidoso que la propia fiesta.",
    },
    images: [
      { src: "/products/neon-tropic.jpg", alt: { en: "Neon Tropic arrangement in electric pink and lime", es: "Arreglo Neón Tropical en rosa eléctrico y lima" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["birthday", "congrats", "just-because"],
    colorFamily: ["pink", "green", "mixed"],
    active: true,
    seo: {
      title: { en: "Neon Tropic — Diva Flowers", es: "Neón Tropical — Diva Flowers" },
      description: {
        en: "Electric tropical arrangement with neon anthurium and cymbidium. Same-day Long Island delivery.",
        es: "Arreglo tropical eléctrico con anturio neón y cymbidium. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-pla-b2-03",
    slug: "opal-orchid",
    title: { en: "Opal Orchid", es: "Orquídea Ópalo" },
    category: "plants",
    blurb: {
      en: "A double-stem phalaenopsis in opal-tone ceramic for the one who keeps things calm.",
      es: "Phalaenopsis de doble tallo en cerámica ópalo para quien mantiene la calma.",
    },
    description: {
      en: "For the friend whose apartment always feels like the right temperature — a double-stem phalaenopsis orchid in a hand-glazed opal ceramic, the kind of plant that quietly outlasts a season. Send it before 2pm and we'll have it on her Long Island doorstep today. A long, slow gesture for the recipient who plays the long game.",
      es: "Para la amiga cuyo apartamento siempre tiene la temperatura justa — una orquídea phalaenopsis de doble tallo en cerámica ópalo esmaltada a mano, la planta que sobrevive temporadas en silencio. Envíalo antes de las 2pm y llega hoy a su puerta de Long Island. Un gesto largo y pausado para quien juega a largo plazo.",
    },
    images: [
      { src: "/products/opal-orchid.jpg", alt: { en: "Opal Orchid double-stem phalaenopsis in ceramic", es: "Orquídea Ópalo phalaenopsis de doble tallo en cerámica" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 11500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 18500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["romance", "anniversary", "congrats", "just-because"],
    colorFamily: ["white", "pastel"],
    active: true,
    seo: {
      title: { en: "Opal Orchid — Diva Flowers", es: "Orquídea Ópalo — Diva Flowers" },
      description: {
        en: "Double-stem phalaenopsis orchid in opal ceramic. Same-day Long Island delivery.",
        es: "Orquídea phalaenopsis de doble tallo en cerámica ópalo. Entrega el mismo día en Long Island.",
      },
    },
  },
  // ─── New catalog imports — Batch 3 (29) ─────────────────
  {
    id: "p-arr-b3-01",
    slug: "paradise-found",
    title: { en: "Paradise Found", es: "Paraíso Encontrado" },
    category: "arrangements",
    blurb: {
      en: "Birds of paradise and orchids for the friend who finally booked the trip.",
      es: "Aves del paraíso y orquídeas para la amiga que por fin reservó el viaje.",
    },
    description: {
      en: "For the one who built the corner of the room they actually want to live in — birds of paradise, cymbidium orchids, and monstera leaves arranged with island weight. The kind of arrangement that says congratulations without needing the word. Order before 2pm and it lands on their Long Island doorstep the same afternoon.",
      es: "Para quien armó el rincón de la casa donde de verdad quiere vivir — aves del paraíso, orquídeas cymbidium y hojas de monstera con peso de isla. El tipo de arreglo que dice felicidades sin tener que decirlo. Pídelo antes de las 2pm y llega a su puerta de Long Island esa misma tarde.",
    },
    images: [
      { src: "/products/paradise-found.jpg", alt: { en: "Paradise Found tropical arrangement with birds of paradise", es: "Arreglo tropical Paraíso Encontrado con aves del paraíso" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["mixed", "green"],
    active: true,
    seo: {
      title: { en: "Paradise Found — Diva Flowers", es: "Paraíso Encontrado — Diva Flowers" },
      description: {
        en: "Tropical birds of paradise and orchid arrangement. Same-day delivery on Long Island.",
        es: "Arreglo tropical de aves del paraíso y orquídeas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-02",
    slug: "pastel-poetry",
    title: { en: "Pastel Poetry", es: "Poesía en Pastel" },
    category: "bouquets",
    blurb: {
      en: "Soft pastels for the friend who answers your texts at 2am.",
      es: "Pasteles suaves para la amiga que contesta tus mensajes a las 2am.",
    },
    description: {
      en: "For the one who keeps the group chat alive — peach roses, lisianthus, and butter ranunculus tied with linen ribbon. A small gesture that lands bigger than expected, because she's the kind of person who notices. Reserve before 2pm and we'll get it across Long Island before sundown.",
      es: "Para quien mantiene viva la conversación del grupo — rosas durazno, lisianthus y ranúnculos mantequilla atados con cinta de lino. Un gesto pequeño que llega más grande de lo previsto, porque ella es de las que se da cuenta. Reserva antes de las 2pm y lo cruzamos Long Island antes del atardecer.",
    },
    images: [
      { src: "/products/pastel-poetry.jpg", alt: { en: "Pastel Poetry soft pastel bouquet of peach roses and ranunculus", es: "Ramo Poesía en Pastel con rosas durazno y ranúnculos" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday", "mothers-day"],
    colorFamily: ["pastel", "pink"],
    active: true,
    seo: {
      title: { en: "Pastel Poetry — Diva Flowers", es: "Poesía en Pastel — Diva Flowers" },
      description: {
        en: "Soft pastel bouquet with peach roses and ranunculus. Same-day delivery on Long Island.",
        es: "Ramo pastel con rosas durazno y ranúnculos. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-03",
    slug: "peach-sunshine",
    title: { en: "Peach Sunshine", es: "Durazno y Sol" },
    category: "bouquets",
    blurb: {
      en: "Peach roses and sunflowers for the birthday that needs no excuse.",
      es: "Rosas durazno y girasoles para el cumpleaños que no necesita excusa.",
    },
    description: {
      en: "For the friend whose laugh you hear before you see her — peach roses, mini sunflowers, and a halo of solidago tied loose so it falls open like the day did. The kind of bouquet that turns the kitchen counter into the party. Order before 2pm for same-day delivery anywhere on Long Island.",
      es: "Para la amiga cuya risa escuchas antes de verla — rosas durazno, mini girasoles y un halo de solidago atado suelto para que se abra como se abrió el día. El ramo que vuelve la cocina la fiesta. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/peach-sunshine.jpg", alt: { en: "Peach Sunshine bouquet of peach roses and mini sunflowers", es: "Ramo Durazno y Sol con rosas durazno y mini girasoles" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 10500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 14500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because"],
    colorFamily: ["pastel", "mixed"],
    active: true,
    seo: {
      title: { en: "Peach Sunshine — Diva Flowers", es: "Durazno y Sol — Diva Flowers" },
      description: {
        en: "Peach rose and sunflower birthday bouquet. Same-day delivery on Long Island.",
        es: "Ramo de cumpleaños con rosas durazno y girasoles. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-04",
    slug: "petal-party",
    title: { en: "Petal Party", es: "Fiesta de Pétalos" },
    category: "arrangements",
    blurb: {
      en: "A loud, bright arrangement for the birthday that earned the cake.",
      es: "Un arreglo fuerte y brillante para el cumple que se ganó el pastel.",
    },
    description: {
      en: "For the one who shows up early and stays late — hot pink roses, gerberas, and ranunculus packed tight in a clear cube vase. No subtlety, all celebration. Reserve before 2pm and we'll set it on her Long Island table before the candles come out.",
      es: "Para quien llega temprano y se queda hasta tarde — rosas fucsia, gerberas y ranúnculos apretados en un cubo de vidrio. Nada de sutileza, todo celebración. Reserva antes de las 2pm y la dejamos en su mesa de Long Island antes de que salgan las velas.",
    },
    images: [
      { src: "/products/petal-party.jpg", alt: { en: "Petal Party bright pink arrangement of roses and gerberas", es: "Arreglo Fiesta de Pétalos con rosas fucsia y gerberas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16000 },
    ],
    addOns: [
      { id: "balloons", label: { en: "Add birthday balloons", es: "Añadir globos de cumpleaños" }, priceCents: 1500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Petal Party — Diva Flowers", es: "Fiesta de Pétalos — Diva Flowers" },
      description: {
        en: "Hot pink birthday arrangement with roses and gerberas. Same-day delivery on Long Island.",
        es: "Arreglo de cumpleaños en fucsia con rosas y gerberas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-05",
    slug: "pink-opus",
    title: { en: "Pink Opus", es: "Opus Rosa" },
    category: "arrangements",
    blurb: {
      en: "A monochrome pink composition for the recipient who curates everything.",
      es: "Una composición rosa monocromática para quien todo lo cura con criterio.",
    },
    description: {
      en: "For the one whose home looks like a magazine spread on a Tuesday — pink garden roses, peonies, and sweet pea layered tonally in a footed bowl. Studied, not stiff. Order before 2pm for Long Island same-day delivery and let the room rearrange itself around it.",
      es: "Para quien tiene la casa de revista un martes cualquiera — rosas de jardín, peonías y guisantes de olor en capas tonales sobre un cuenco con base. Estudiado, no rígido. Pídelo antes de las 2pm para entrega el mismo día en Long Island y deja que la sala se reordene a su alrededor.",
    },
    images: [
      { src: "/products/pink-opus.jpg", alt: { en: "Pink Opus monochrome pink arrangement of garden roses and peonies", es: "Arreglo Opus Rosa monocromático con rosas de jardín y peonías" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 19500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["romance", "anniversary", "just-because"],
    colorFamily: ["pink"],
    active: true,
    seo: {
      title: { en: "Pink Opus — Diva Flowers", es: "Opus Rosa — Diva Flowers" },
      description: {
        en: "Monochrome pink arrangement with garden roses and peonies. Same-day delivery on Long Island.",
        es: "Arreglo monocromático rosa con rosas de jardín y peonías. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-06",
    slug: "purple-haze",
    title: { en: "Purple Haze", es: "Bruma Púrpura" },
    category: "bouquets",
    blurb: {
      en: "Lavender, lisianthus, and dark dahlia for the friend with the playlist.",
      es: "Lavanda, lisianthus y dalia oscura para la amiga con la playlist.",
    },
    description: {
      en: "For the one who texts you a song instead of a how-are-you — purple lisianthus, dahlias, and trailing lavender wrapped in kraft. A little moody, a lot warm. Reserve before 2pm for same-day Long Island delivery and let it land like a song she didn't know she needed.",
      es: "Para quien te manda una canción en vez de un cómo-estás — lisianthus morado, dalias y lavanda colgante envueltos en kraft. Un poco oscuro, muy cálido. Reserva antes de las 2pm para entrega el mismo día en Long Island y déjalo caer como una canción que no sabía que le hacía falta.",
    },
    images: [
      { src: "/products/purple-haze.jpg", alt: { en: "Purple Haze bouquet with lisianthus dahlia and lavender", es: "Ramo Bruma Púrpura con lisianthus, dalia y lavanda" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["romance", "anniversary", "birthday", "just-because"],
    colorFamily: ["mixed", "pink"],
    active: true,
    seo: {
      title: { en: "Purple Haze — Diva Flowers", es: "Bruma Púrpura — Diva Flowers" },
      description: {
        en: "Purple lisianthus dahlia and lavender bouquet. Same-day delivery on Long Island.",
        es: "Ramo morado con lisianthus, dalia y lavanda. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-07",
    slug: "rainbow-reverie",
    title: { en: "Rainbow Reverie", es: "Ensueño Arcoíris" },
    category: "bouquets",
    blurb: {
      en: "Every color, on purpose — for the friend who deserves the whole spectrum.",
      es: "Todos los colores, a propósito — para la amiga que merece el espectro entero.",
    },
    description: {
      en: "For the one who refuses to pick a favorite — roses, ranunculus, and snapdragons in every color we cut this morning, gathered loose. The bouquet of someone who lives big. Order before 2pm for same-day delivery anywhere on Long Island.",
      es: "Para quien se niega a tener favorito — rosas, ranúnculos y dragoncillos en todos los colores que cortamos esta mañana, atados sueltos. El ramo de alguien que vive en grande. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/rainbow-reverie.jpg", alt: { en: "Rainbow Reverie multicolor bouquet of roses and ranunculus", es: "Ramo Ensueño Arcoíris multicolor con rosas y ranúnculos" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Rainbow Reverie — Diva Flowers", es: "Ensueño Arcoíris — Diva Flowers" },
      description: {
        en: "Multicolor bouquet of roses ranunculus and snapdragons. Same-day delivery on Long Island.",
        es: "Ramo multicolor con rosas, ranúnculos y dragoncillos. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-08",
    slug: "santas-garden",
    title: { en: "Santa's Garden", es: "El Jardín de Santa" },
    category: "arrangements",
    blurb: {
      en: "Red, white, and evergreen for the host who lights up the block.",
      es: "Rojo, blanco y siempreverde para quien enciende la cuadra entera.",
    },
    description: {
      en: "For the one who hangs the wreath the morning after Thanksgiving — red roses, white amaryllis, cedar, and pine cones in a footed vase. Christmas without the cliché. Reserve before 2pm and we'll have it on the Long Island mantle before guests arrive.",
      es: "Para quien cuelga la corona la mañana después de Acción de Gracias — rosas rojas, amaryllis blanco, cedro y piñas sobre un florero con base. Navidad sin lo cliché. Reserva antes de las 2pm y la dejamos en la chimenea de Long Island antes de que lleguen los invitados.",
    },
    images: [
      { src: "/products/santas-garden.jpg", alt: { en: "Santa's Garden Christmas arrangement with red roses and amaryllis", es: "Arreglo navideño El Jardín de Santa con rosas rojas y amaryllis" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "seasonal"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["red", "green", "white"],
    active: true,
    seo: {
      title: { en: "Santa's Garden — Diva Flowers", es: "El Jardín de Santa — Diva Flowers" },
      description: {
        en: "Christmas arrangement with red roses, amaryllis, and cedar. Same-day delivery on Long Island.",
        es: "Arreglo navideño con rosas rojas, amaryllis y cedro. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-09",
    slug: "springbling",
    title: { en: "Springbling", es: "Brillo de Primavera" },
    category: "bouquets",
    blurb: {
      en: "Tulips, ranunculus, and anemones for the first warm day of the year.",
      es: "Tulipanes, ranúnculos y anémonas para el primer día tibio del año.",
    },
    description: {
      en: "For the one who opens every window the moment the sun returns — French tulips, ranunculus, and anemones cut this morning at the farm. The bouquet that announces the season. Order before 2pm for same-day delivery on Long Island and let her kitchen catch up to April.",
      es: "Para quien abre todas las ventanas en cuanto vuelve el sol — tulipanes franceses, ranúnculos y anémonas cortados esta mañana en la finca. El ramo que anuncia la temporada. Pídelo antes de las 2pm para entrega el mismo día en Long Island y deja que su cocina se ponga al día con abril.",
    },
    images: [
      { src: "/products/springbling.jpg", alt: { en: "Springbling spring bouquet with French tulips and anemones", es: "Ramo primaveral Brillo de Primavera con tulipanes y anémonas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15000 },
    ],
    tags: ["new", "seasonal", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["pastel", "mixed"],
    active: true,
    seo: {
      title: { en: "Springbling — Diva Flowers", es: "Brillo de Primavera — Diva Flowers" },
      description: {
        en: "Spring bouquet with French tulips, ranunculus, and anemones. Same-day delivery on Long Island.",
        es: "Ramo primaveral con tulipanes franceses, ranúnculos y anémonas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-10",
    slug: "stem-theory",
    title: { en: "Stem Theory", es: "Teoría del Tallo" },
    category: "bouquets",
    blurb: {
      en: "An architectural bouquet for the one who edits everything.",
      es: "Un ramo arquitectónico para quien todo lo edita.",
    },
    description: {
      en: "For the friend whose taste makes you second-guess your own — long-stem calla lilies, white roses, and bear grass tied tall. Restraint as gesture. Reserve before 2pm and we'll get it across Long Island before the dinner she's hosting tonight.",
      es: "Para la amiga cuyo gusto te hace dudar del tuyo — calas de tallo largo, rosas blancas y pasto oso atado alto. La contención como gesto. Reserva antes de las 2pm y lo cruzamos Long Island antes de la cena que está organizando esta noche.",
    },
    images: [
      { src: "/products/stem-theory.jpg", alt: { en: "Stem Theory architectural bouquet of calla lilies and white roses", es: "Ramo arquitectónico Teoría del Tallo con calas y rosas blancas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 18500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Stem Theory — Diva Flowers", es: "Teoría del Tallo — Diva Flowers" },
      description: {
        en: "Architectural bouquet of calla lilies and white roses. Same-day delivery on Long Island.",
        es: "Ramo arquitectónico con calas y rosas blancas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-11",
    slug: "sugarplum",
    title: { en: "Sugarplum", es: "Ciruela Dulce" },
    category: "arrangements",
    blurb: {
      en: "Plum, blush, and burgundy for the holiday hostess who runs the room.",
      es: "Ciruela, rubor y borgoña para la anfitriona que mueve la sala.",
    },
    description: {
      en: "For the one whose table has assigned seating and a soundtrack — burgundy dahlias, plum lisianthus, and blush garden roses in a low compote. Holiday color, dinner-party scale. Order before 2pm and we'll set it on her Long Island table before the first knock at the door.",
      es: "Para quien tiene la mesa con lugares asignados y banda sonora — dalias borgoña, lisianthus ciruela y rosas de jardín en compota baja. Color de fiesta, escala de cena. Pídelo antes de las 2pm y lo dejamos en su mesa de Long Island antes del primer toque en la puerta.",
    },
    images: [
      { src: "/products/sugarplum.jpg", alt: { en: "Sugarplum holiday arrangement with burgundy dahlias and plum lisianthus", es: "Arreglo navideño Ciruela Dulce con dalias borgoña y lisianthus ciruela" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 18500 },
    ],
    tags: ["new", "seasonal"],
    occasions: ["romance", "anniversary", "birthday", "just-because"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Sugarplum — Diva Flowers", es: "Ciruela Dulce — Diva Flowers" },
      description: {
        en: "Holiday arrangement in burgundy, plum, and blush. Same-day delivery on Long Island.",
        es: "Arreglo navideño en borgoña, ciruela y rubor. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-12",
    slug: "sunlit-tropics",
    title: { en: "Sunlit Tropics", es: "Trópico Iluminado" },
    category: "arrangements",
    blurb: {
      en: "Yellow ginger, anthurium, and palm for the friend who holds summer year-round.",
      es: "Jengibre amarillo, anturio y palma para quien lleva el verano todo el año.",
    },
    description: {
      en: "For the one who never quite came back from that trip — yellow ginger, peach anthurium, and fan palm in a tall ceramic. The arrangement that turns a weekday into an island morning. Reserve before 2pm for same-day Long Island delivery and let the kitchen smell warmer than it is.",
      es: "Para quien nunca volvió del todo de aquel viaje — jengibre amarillo, anturio durazno y palma abanico en cerámica alta. El arreglo que convierte un martes en una mañana de isla. Reserva antes de las 2pm para entrega el mismo día en Long Island y deja que la cocina huela más cálida de lo que está.",
    },
    images: [
      { src: "/products/sunlit-tropics.jpg", alt: { en: "Sunlit Tropics arrangement with yellow ginger, anthurium, and palm", es: "Arreglo Trópico Iluminado con jengibre amarillo, anturio y palma" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17000 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["mixed", "pastel"],
    active: true,
    seo: {
      title: { en: "Sunlit Tropics — Diva Flowers", es: "Trópico Iluminado — Diva Flowers" },
      description: {
        en: "Tropical arrangement with ginger, anthurium, and palm. Same-day delivery on Long Island.",
        es: "Arreglo tropical con jengibre, anturio y palma. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-13",
    slug: "sunset-estate",
    title: { en: "Sunset Estate", es: "Hacienda al Atardecer" },
    category: "arrangements",
    blurb: {
      en: "Coral, amber, and cream roses for the anniversary worth the long drive.",
      es: "Coral, ámbar y crema para el aniversario que vale el viaje largo.",
    },
    description: {
      en: "For the couple who learned to slow down on the back porch — coral roses, amber lisianthus, and cream garden roses in a wide footed bowl. Anniversary weight without the obvious red. Reserve before 2pm and it'll be on their Long Island table before the porch lights come on.",
      es: "Para la pareja que aprendió a bajar el ritmo en el porche — rosas coral, lisianthus ámbar y rosas de jardín crema en un cuenco amplio con base. Peso de aniversario sin el rojo obvio. Reserva antes de las 2pm y estará en su mesa de Long Island antes de que se enciendan las luces del porche.",
    },
    images: [
      { src: "/products/sunset-estate.jpg", alt: { en: "Sunset Estate arrangement with coral, amber, and cream roses", es: "Arreglo Hacienda al Atardecer con rosas coral, ámbar y crema" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 10500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 19500 },
    ],
    addOns: [
      { id: "wine", label: { en: "Add bottle of red wine", es: "Añadir botella de vino tinto" }, priceCents: 4500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["anniversary", "romance"],
    colorFamily: ["mixed", "pink"],
    active: true,
    seo: {
      title: { en: "Sunset Estate — Diva Flowers", es: "Hacienda al Atardecer — Diva Flowers" },
      description: {
        en: "Anniversary arrangement in coral, amber, and cream. Same-day delivery on Long Island.",
        es: "Arreglo de aniversario en coral, ámbar y crema. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-gif-b3-14",
    slug: "sunshine-basket",
    title: { en: "Sunshine Basket", es: "Canasta de Sol" },
    category: "gifts",
    blurb: {
      en: "Sunflowers, daisies, and yellow roses for the friend who walked through it.",
      es: "Girasoles, margaritas y rosas amarillas para la amiga que lo cruzó.",
    },
    description: {
      en: "For the one who finally answered the phone laughing again — sunflowers, white daisies, and yellow roses in a woven basket she'll keep using. A get-well, a thank-you, a thinking-of-you, all at once. Order before 2pm for same-day delivery on Long Island.",
      es: "Para quien por fin contestó el teléfono riéndose otra vez — girasoles, margaritas blancas y rosas amarillas en una canasta tejida que va a seguir usando. Un que-te-mejores, un gracias, un pensando-en-ti, todo a la vez. Pídela antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/sunshine-basket.jpg", alt: { en: "Sunshine Basket of sunflowers, daisies, and yellow roses", es: "Canasta de Sol con girasoles, margaritas y rosas amarillas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 10500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 14000 },
    ],
    tags: ["new", "same-day"],
    occasions: ["just-because", "birthday", "get-well"],
    colorFamily: ["mixed", "white"],
    active: true,
    seo: {
      title: { en: "Sunshine Basket — Diva Flowers", es: "Canasta de Sol — Diva Flowers" },
      description: {
        en: "Sunflower and yellow rose basket. Same-day delivery on Long Island.",
        es: "Canasta con girasoles y rosas amarillas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-15",
    slug: "talitas-bouquet",
    title: { en: "Talita's Bouquet", es: "El Ramo de Talita" },
    category: "bouquets",
    blurb: {
      en: "Blush roses and white peonies for the small gesture that lands big.",
      es: "Rosas rubor y peonías blancas para el gesto pequeño que llega grande.",
    },
    description: {
      en: "For the one who never asks for anything and quietly does everything — blush roses, white peonies, and trailing eucalyptus tied in soft linen. The bouquet of someone who pays attention. Reserve before 2pm and we'll have it at her Long Island door before she finishes her coffee.",
      es: "Para quien nunca pide nada y hace todo en silencio — rosas rubor, peonías blancas y eucalipto colgante atado en lino suave. El ramo de quien presta atención. Reserva antes de las 2pm y llega a su puerta de Long Island antes de que termine el café.",
    },
    images: [
      { src: "/products/talitas-bouquet.jpg", alt: { en: "Talita's Bouquet with blush roses and white peonies", es: "Ramo de Talita con rosas rubor y peonías blancas" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17000 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "just-because"],
    colorFamily: ["pink", "white"],
    active: true,
    seo: {
      title: { en: "Talita's Bouquet — Diva Flowers", es: "El Ramo de Talita — Diva Flowers" },
      description: {
        en: "Blush rose and white peony bouquet. Same-day delivery on Long Island.",
        es: "Ramo de rosas rubor y peonías blancas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-16",
    slug: "the-heart-you-hold",
    title: { en: "The Heart You Hold", es: "El Corazón que Llevas" },
    category: "bouquets",
    blurb: {
      en: "Red and burgundy roses for the love that didn't need an occasion.",
      es: "Rosas rojas y borgoña para el amor que no necesitó ocasión.",
    },
    description: {
      en: "For the one you'd send flowers to on a Wednesday — red garden roses, burgundy dahlias, and dark ranunculus tied in velvet. The bouquet for the love that surprises itself. Order before 2pm for same-day delivery on Long Island and let the kitchen counter say what you keep meaning to.",
      es: "Para quien le mandarías flores un miércoles — rosas de jardín rojas, dalias borgoña y ranúnculos oscuros atados en terciopelo. El ramo del amor que se sorprende a sí mismo. Pídelo antes de las 2pm para entrega el mismo día en Long Island y deja que la encimera diga lo que vienes queriendo decir.",
    },
    images: [
      { src: "/products/the-heart-you-hold.jpg", alt: { en: "The Heart You Hold red and burgundy rose bouquet", es: "Ramo El Corazón que Llevas con rosas rojas y borgoña" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 19500 },
    ],
    addOns: [
      { id: "chocolates", label: { en: "Add dark chocolate truffles", es: "Añadir trufas de chocolate oscuro" }, priceCents: 3500 },
    ],
    tags: ["new", "staff-pick", "same-day"],
    occasions: ["romance", "anniversary", "just-because"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "The Heart You Hold — Diva Flowers", es: "El Corazón que Llevas — Diva Flowers" },
      description: {
        en: "Red and burgundy rose bouquet for romance. Same-day delivery on Long Island.",
        es: "Ramo de rosas rojas y borgoña para el romance. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-sym-b3-17",
    slug: "thorn-grace",
    title: { en: "Thorn & Grace", es: "Espina y Gracia" },
    category: "arrangements",
    blurb: {
      en: "White roses and olive branches for the quiet presence that matters most.",
      es: "Rosas blancas y ramas de olivo para la presencia callada que más importa.",
    },
    description: {
      en: "For the family who needs the room held without words — white garden roses, olive branches, and white lisianthus arranged low in a neutral compote. Sent the way condolence should arrive — early, steady, without performance. Order before 2pm and we'll deliver it across Long Island the same afternoon.",
      es: "Para la familia que necesita que se sostenga el cuarto sin palabras — rosas blancas de jardín, ramas de olivo y lisianthus blanco en compota baja y neutra. Enviado como debe llegar el pésame — temprano, firme, sin teatro. Pídelo antes de las 2pm y lo llevamos por Long Island esa misma tarde.",
    },
    images: [
      { src: "/products/thorn-grace.jpg", alt: { en: "Thorn and Grace sympathy arrangement with white roses and olive branches", es: "Arreglo de pésame Espina y Gracia con rosas blancas y ramas de olivo" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 16500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["sympathy"],
    colorFamily: ["white", "green"],
    active: true,
    seo: {
      title: { en: "Thorn & Grace — Diva Flowers", es: "Espina y Gracia — Diva Flowers" },
      description: {
        en: "Sympathy arrangement with white roses and olive branches. Same-day delivery on Long Island.",
        es: "Arreglo de pésame con rosas blancas y ramas de olivo. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-18",
    slug: "three-dozen-roses-in-vase",
    title: { en: "Three Dozen Roses in Vase", es: "Tres Docenas de Rosas en Florero" },
    category: "bouquets",
    blurb: {
      en: "Thirty-six long-stem roses for the anniversary they'll talk about for years.",
      es: "Treinta y seis rosas de tallo largo para el aniversario del que hablarán por años.",
    },
    description: {
      en: "For the one who knows that some moments deserve a number — thirty-six long-stem red roses, hand-cut, hand-conditioned, set in a tall clear vase. The arrangement of someone who refuses to play it small. Reserve before 2pm and we'll carry it to their Long Island door before they get home.",
      es: "Para quien sabe que ciertos momentos merecen un número — treinta y seis rosas rojas de tallo largo, cortadas y acondicionadas a mano, en un florero alto y transparente. El arreglo de quien se niega a jugar en pequeño. Reserva antes de las 2pm y lo llevamos a su puerta de Long Island antes de que llegue a casa.",
    },
    images: [
      { src: "/products/three-dozen-roses-in-vase.png", alt: { en: "Three dozen long-stem red roses in tall clear vase", es: "Tres docenas de rosas rojas de tallo largo en florero alto" }, aspect: "4/5" },
    ],
    variants: [
      { id: "red", label: { en: "Classic Red", es: "Rojo Clásico" }, priceCents: 27500 },
      { id: "mixed", label: { en: "Mixed Color", es: "Multicolor" }, priceCents: 29500 },
      { id: "premium", label: { en: "Premium Ecuadorian", es: "Premium Ecuatoriana" }, priceCents: 34500 },
    ],
    addOns: [
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
      { id: "chocolates", label: { en: "Add dark chocolate truffles", es: "Añadir trufas de chocolate oscuro" }, priceCents: 3500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["anniversary", "romance", "birthday", "congrats", "just-because"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "Three Dozen Roses in Vase — Diva Flowers", es: "Tres Docenas de Rosas en Florero — Diva Flowers" },
      description: {
        en: "36 long-stem red roses in a tall vase. Same-day delivery on Long Island.",
        es: "36 rosas rojas de tallo largo en florero alto. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-19",
    slug: "timeless-romance",
    title: { en: "Timeless Romance", es: "Romance Atemporal" },
    category: "bouquets",
    blurb: {
      en: "Cream and blush roses for the anniversary that earned its quiet.",
      es: "Rosas crema y rubor para el aniversario que se ganó su silencio.",
    },
    description: {
      en: "For the couple who learned that love is a long conversation — twenty-four cream and blush roses with garden-cut stems, gathered the way they were on the first one. Reserve before 2pm and we'll have it at their Long Island door before dinner. The flowers for the years they'll keep telling.",
      es: "Para la pareja que aprendió que el amor es una conversación larga — veinticuatro rosas crema y rubor de tallo cortado en jardín, atadas como las del primer aniversario. Reserva antes de las 2pm y llegará a su puerta de Long Island antes de la cena. Las flores de los años que seguirán contando.",
    },
    images: [
      { src: "/products/timeless-romance.jpg", alt: { en: "Timeless Romance cream and blush rose bouquet", es: "Ramo Romance Atemporal de rosas crema y rubor" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 21500 },
    ],
    addOns: [
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["anniversary", "romance", "birthday", "congrats", "just-because"],
    colorFamily: ["pink", "white"],
    active: true,
    seo: {
      title: { en: "Timeless Romance — Diva Flowers", es: "Romance Atemporal — Diva Flowers" },
      description: {
        en: "Cream and blush rose anniversary bouquet. Same-day delivery on Long Island.",
        es: "Ramo aniversario de rosas crema y rubor. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-20",
    slug: "tropic-thunder",
    title: { en: "Tropic Thunder", es: "Trueno Tropical" },
    category: "arrangements",
    blurb: {
      en: "Hot pink ginger and red anthurium for the friend who arrives loud.",
      es: "Jengibre fucsia y anturio rojo para la amiga que llega con ruido.",
    },
    description: {
      en: "For the one whose entrance you hear from the parking lot — hot pink ginger, red anthurium, and dark monstera in a footed ceramic. Tropical with volume turned up. Order before 2pm for same-day delivery on Long Island and watch the room reorient.",
      es: "Para quien le escuchas la entrada desde el parking — jengibre fucsia, anturio rojo y monstera oscura en cerámica con base. Tropical con el volumen arriba. Pídelo antes de las 2pm para entrega el mismo día en Long Island y mira cómo se reorienta la sala.",
    },
    images: [
      { src: "/products/tropic-thunder.jpg", alt: { en: "Tropic Thunder bold tropical arrangement with pink ginger and anthurium", es: "Arreglo tropical Trueno Tropical con jengibre fucsia y anturio" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "just-because", "congrats"],
    colorFamily: ["pink", "red", "mixed"],
    active: true,
    seo: {
      title: { en: "Tropic Thunder — Diva Flowers", es: "Trueno Tropical — Diva Flowers" },
      description: {
        en: "Bold tropical arrangement with ginger and anthurium. Same-day delivery on Long Island.",
        es: "Arreglo tropical intenso con jengibre y anturio. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-21",
    slug: "tropical-paradise",
    title: { en: "Tropical Paradise", es: "Paraíso Tropical" },
    category: "arrangements",
    blurb: {
      en: "Orchids, anthurium, and palm for the housewarming that finally feels like home.",
      es: "Orquídeas, anturio y palma para la inauguración que por fin se siente casa.",
    },
    description: {
      en: "For the friend who finally hung the art and bought the rug — white phalaenopsis, peach anthurium, and travelers palm in a ceramic urn. Congratulations in tropical syntax. Reserve before 2pm and we'll set it in the new Long Island living room before the first guest knocks.",
      es: "Para la amiga que por fin colgó los cuadros y compró la alfombra — phalaenopsis blanca, anturio durazno y palma del viajero en urna cerámica. Felicidades en sintaxis tropical. Reserva antes de las 2pm y lo dejamos en la nueva sala de Long Island antes del primer invitado.",
    },
    images: [
      { src: "/products/tropical-paradise.jpg", alt: { en: "Tropical Paradise arrangement with phalaenopsis orchids and anthurium", es: "Arreglo Paraíso Tropical con orquídeas phalaenopsis y anturio" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 18500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["congrats", "just-because"],
    colorFamily: ["white", "pastel", "green"],
    active: true,
    seo: {
      title: { en: "Tropical Paradise — Diva Flowers", es: "Paraíso Tropical — Diva Flowers" },
      description: {
        en: "Tropical arrangement with phalaenopsis and anthurium. Same-day delivery on Long Island.",
        es: "Arreglo tropical con phalaenopsis y anturio. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-22",
    slug: "two-dozen-roses-in-vase",
    title: { en: "Two Dozen Roses in Vase", es: "Dos Docenas de Rosas en Florero" },
    category: "bouquets",
    blurb: {
      en: "Twenty-four long-stem red roses for the anniversary that doesn't need explaining.",
      es: "Veinticuatro rosas rojas de tallo largo para el aniversario que no se explica.",
    },
    description: {
      en: "For the one who knows the gesture is the message — twenty-four long-stem red roses, conditioned overnight, set in a clear cylinder. The classic, done right. Order before 2pm for same-day delivery on Long Island and let the front door do the talking.",
      es: "Para quien sabe que el gesto es el mensaje — veinticuatro rosas rojas de tallo largo, acondicionadas la noche anterior, en cilindro transparente. El clásico, bien hecho. Pídelas antes de las 2pm para entrega el mismo día en Long Island y deja que la puerta hable por ti.",
    },
    images: [
      { src: "/products/two-dozen-roses-in-vase.png", alt: { en: "Two dozen long-stem red roses in clear cylinder vase", es: "Dos docenas de rosas rojas de tallo largo en florero cilíndrico" }, aspect: "4/5" },
    ],
    variants: [
      { id: "red", label: { en: "Classic Red", es: "Rojo Clásico" }, priceCents: 18500 },
      { id: "mixed", label: { en: "Mixed Color", es: "Multicolor" }, priceCents: 19500 },
      { id: "premium", label: { en: "Premium Ecuadorian", es: "Premium Ecuatoriana" }, priceCents: 24500 },
    ],
    addOns: [
      { id: "champagne", label: { en: "Add Veuve Clicquot", es: "Añadir Veuve Clicquot" }, priceCents: 8900 },
      { id: "chocolates", label: { en: "Add dark chocolate truffles", es: "Añadir trufas de chocolate oscuro" }, priceCents: 3500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["anniversary", "romance", "birthday", "congrats", "just-because"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "Two Dozen Roses in Vase — Diva Flowers", es: "Dos Docenas de Rosas en Florero — Diva Flowers" },
      description: {
        en: "24 long-stem red roses in a clear vase. Same-day delivery on Long Island.",
        es: "24 rosas rojas de tallo largo en florero transparente. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-23",
    slug: "under-the-mistletoe",
    title: { en: "Under the Mistletoe", es: "Bajo el Muérdago" },
    category: "arrangements",
    blurb: {
      en: "Red roses, cedar, and mistletoe for the kiss the holidays earned.",
      es: "Rosas rojas, cedro y muérdago para el beso que se ganó la temporada.",
    },
    description: {
      en: "For the couple who turn the kitchen island into a slow dance floor in December — red roses, cedar, eucalyptus, and a sprig of real mistletoe in a ceramic bowl. The arrangement that makes the doorway worth pausing under. Reserve before 2pm for same-day Long Island delivery.",
      es: "Para la pareja que convierte la isla de la cocina en pista de baile lento en diciembre — rosas rojas, cedro, eucalipto y una rama de muérdago real en cuenco de cerámica. El arreglo que hace que valga la pena detenerse en la puerta. Reserva antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/under-the-mistletoe.jpg", alt: { en: "Under the Mistletoe holiday arrangement with red roses and cedar", es: "Arreglo navideño Bajo el Muérdago con rosas rojas y cedro" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17500 },
    ],
    tags: ["new", "seasonal", "same-day"],
    occasions: ["romance", "anniversary", "just-because"],
    colorFamily: ["red", "green"],
    active: true,
    seo: {
      title: { en: "Under the Mistletoe — Diva Flowers", es: "Bajo el Muérdago — Diva Flowers" },
      description: {
        en: "Holiday arrangement with red roses, cedar, and mistletoe. Same-day delivery on Long Island.",
        es: "Arreglo navideño con rosas rojas, cedro y muérdago. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-24",
    slug: "velvet-garden",
    title: { en: "Velvet Garden", es: "Jardín de Terciopelo" },
    category: "arrangements",
    blurb: {
      en: "Burgundy dahlias and dark roses for the romance that runs deep.",
      es: "Dalias borgoña y rosas oscuras para el romance que corre hondo.",
    },
    description: {
      en: "For the one who reads in the dark and means it — burgundy dahlias, black baccara roses, and plum lisianthus arranged low in a footed bronze. Romance with weight. Order before 2pm and we'll have it on their Long Island bedside before evening.",
      es: "Para quien lee en la penumbra y lo dice de verdad — dalias borgoña, rosas black baccara y lisianthus ciruela en compota baja de bronce. Romance con peso. Pídelo antes de las 2pm y estará en su mesa de noche de Long Island antes del anochecer.",
    },
    images: [
      { src: "/products/velvet-garden.jpg", alt: { en: "Velvet Garden arrangement with burgundy dahlias and dark roses", es: "Arreglo Jardín de Terciopelo con dalias borgoña y rosas oscuras" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 14000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 19000 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["romance", "anniversary"],
    colorFamily: ["red", "mixed"],
    active: true,
    seo: {
      title: { en: "Velvet Garden — Diva Flowers", es: "Jardín de Terciopelo — Diva Flowers" },
      description: {
        en: "Romantic arrangement with burgundy dahlias and dark roses. Same-day delivery on Long Island.",
        es: "Arreglo romántico con dalias borgoña y rosas oscuras. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-25",
    slug: "vibrant-vibes",
    title: { en: "Vibrant Vibes", es: "Vibras Vibrantes" },
    category: "bouquets",
    blurb: {
      en: "Hot color, no apology — for the friend who took the leap.",
      es: "Color fuerte, sin disculpa — para la amiga que se lanzó.",
    },
    description: {
      en: "For the one who quit the job, signed the lease, said the thing — fuchsia roses, orange ranunculus, and yellow craspedia tied loud. Congratulations as a color story. Reserve before 2pm and we'll get it across Long Island before the celebration drinks.",
      es: "Para quien renunció, firmó el contrato, dijo lo que tenía que decir — rosas fucsia, ranúnculos naranja y craspedia amarilla atados fuerte. Felicidades como historia de color. Reserva antes de las 2pm y lo cruzamos Long Island antes de los tragos de celebración.",
    },
    images: [
      { src: "/products/vibrant-vibes.jpg", alt: { en: "Vibrant Vibes bold bouquet with fuchsia roses and orange ranunculus", es: "Ramo Vibras Vibrantes con rosas fucsia y ranúnculos naranja" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["congrats", "birthday", "just-because"],
    colorFamily: ["pink", "mixed"],
    active: true,
    seo: {
      title: { en: "Vibrant Vibes — Diva Flowers", es: "Vibras Vibrantes — Diva Flowers" },
      description: {
        en: "Bold bouquet with fuchsia roses and orange ranunculus. Same-day delivery on Long Island.",
        es: "Ramo intenso con rosas fucsia y ranúnculos naranja. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-26",
    slug: "viva-maky",
    title: { en: "Viva Maky", es: "Viva Maky" },
    category: "arrangements",
    blurb: {
      en: "The designer's bold statement piece — color, scale, and signature.",
      es: "La pieza firma de la diseñadora — color, escala y carácter.",
    },
    description: {
      en: "For the one who wants the room to know — Maky's signature mix of garden roses, dahlias, and seasonal accents in a footed compote, designed wide and unrepeated. The arrangement that turns the entryway into the headline. Reserve before 2pm and we'll deliver it across Long Island before guests arrive.",
      es: "Para quien quiere que la sala se entere — la mezcla firma de Maky con rosas de jardín, dalias y acentos de temporada en compota con base, diseñada ancha y sin repetirse. El arreglo que vuelve el recibidor el titular. Reserva antes de las 2pm y lo entregamos por Long Island antes de que lleguen los invitados.",
    },
    images: [
      { src: "/products/viva-maky.jpg", alt: { en: "Viva Maky designer signature arrangement with garden roses and dahlias", es: "Arreglo firma de diseñadora Viva Maky con rosas de jardín y dalias" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Designer Standard", es: "Diseñadora Estándar" }, priceCents: 12500 },
      { id: "grand", label: { en: "Designer Grand", es: "Diseñadora Grande" }, priceCents: 17500 },
      { id: "diva", label: { en: "Designer Diva", es: "Diseñadora Diva" }, priceCents: 24500 },
    ],
    tags: ["new", "staff-pick"],
    occasions: ["romance", "anniversary", "congrats", "just-because"],
    colorFamily: ["mixed"],
    active: true,
    seo: {
      title: { en: "Viva Maky — Diva Flowers", es: "Viva Maky — Diva Flowers" },
      description: {
        en: "Designer's choice arrangement by Maky. Same-day delivery on Long Island.",
        es: "Arreglo de la elección de la diseñadora Maky. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-27",
    slug: "whispers-of-spring",
    title: { en: "Whispers of Spring", es: "Susurros de Primavera" },
    category: "bouquets",
    blurb: {
      en: "Hyacinth, tulips, and lily of the valley for the first warm Saturday.",
      es: "Jacintos, tulipanes y lirios del valle para el primer sábado tibio.",
    },
    description: {
      en: "For the one who keeps the windows cracked through March — pale hyacinth, French tulips, and lily of the valley tied in raffia. The bouquet of someone who notices the season turning before anyone else. Order before 2pm for same-day delivery on Long Island.",
      es: "Para quien mantiene las ventanas entreabiertas hasta marzo — jacintos pálidos, tulipanes franceses y lirios del valle atados con rafia. El ramo de quien nota el cambio de estación antes que nadie. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/whispers-of-spring.jpg", alt: { en: "Whispers of Spring bouquet with hyacinth and French tulips", es: "Ramo Susurros de Primavera con jacintos y tulipanes franceses" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 7500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 11000 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 15000 },
    ],
    tags: ["new", "seasonal", "same-day"],
    occasions: ["just-because", "birthday"],
    colorFamily: ["pastel", "white"],
    active: true,
    seo: {
      title: { en: "Whispers of Spring — Diva Flowers", es: "Susurros de Primavera — Diva Flowers" },
      description: {
        en: "Spring bouquet with hyacinth and French tulips. Same-day delivery on Long Island.",
        es: "Ramo primaveral con jacintos y tulipanes franceses. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-b3-28",
    slug: "wildflower-meadow",
    title: { en: "Wildflower Meadow", es: "Pradera Silvestre" },
    category: "bouquets",
    blurb: {
      en: "Loose meadow stems for the friend who walks the long way home.",
      es: "Tallos sueltos de pradera para la amiga que toma el camino largo a casa.",
    },
    description: {
      en: "For the one who pulls over for the side-of-the-road blooms — cosmos, queen anne's lace, daisies, and seasonal field stems gathered loose like you cut them yourself. A small gesture that lands like a Sunday morning. Order before 2pm for same-day delivery on Long Island.",
      es: "Para quien se para a recoger las flores del borde del camino — cosmos, encaje de la reina, margaritas y tallos de campo de temporada atados sueltos como si los cortara ella. Un gesto pequeño que llega como una mañana de domingo. Pídelo antes de las 2pm para entrega el mismo día en Long Island.",
    },
    images: [
      { src: "/products/wildflower-meadow.jpg", alt: { en: "Wildflower Meadow loose bouquet with cosmos and queen anne's lace", es: "Ramo Pradera Silvestre suelto con cosmos y encaje de la reina" }, aspect: "4/5" },
    ],
    variants: [
      { id: "petite", label: { en: "Petite", es: "Pequeño" }, priceCents: 6500 },
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 9500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 13500 },
    ],
    tags: ["new", "same-day", "seasonal"],
    occasions: ["just-because", "birthday", "mothers-day"],
    colorFamily: ["mixed", "pastel"],
    active: true,
    seo: {
      title: { en: "Wildflower Meadow — Diva Flowers", es: "Pradera Silvestre — Diva Flowers" },
      description: {
        en: "Loose meadow bouquet with cosmos and daisies. Same-day delivery on Long Island.",
        es: "Ramo suelto de pradera con cosmos y margaritas. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-arr-b3-29",
    slug: "winter-moss",
    title: { en: "Winter Moss", es: "Musgo de Invierno" },
    category: "arrangements",
    blurb: {
      en: "Cedar, moss, and white amaryllis for the host who keeps it quiet.",
      es: "Cedro, musgo y amaryllis blanco para el anfitrión que va sin ruido.",
    },
    description: {
      en: "For the one whose holiday is cashmere and a fire, not tinsel — cedar, reindeer moss, white amaryllis, and seeded eucalyptus in a stoneware bowl. Seasonal without the sparkle. Reserve before 2pm and we'll set it on their Long Island table before the fire is lit.",
      es: "Para quien la temporada es cachemir y chimenea, no oropel — cedro, musgo de reno, amaryllis blanco y eucalipto con semilla en cuenco de gres. De temporada sin el brillo. Reserva antes de las 2pm y lo dejamos en su mesa de Long Island antes de que se encienda el fuego.",
    },
    images: [
      { src: "/products/winter-moss.jpg", alt: { en: "Winter Moss arrangement with cedar, moss, and white amaryllis", es: "Arreglo Musgo de Invierno con cedro, musgo y amaryllis blanco" }, aspect: "4/5" },
    ],
    variants: [
      { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
      { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17000 },
    ],
    tags: ["new", "seasonal", "staff-pick"],
    occasions: ["birthday", "congrats", "just-because"],
    colorFamily: ["green", "white"],
    active: true,
    seo: {
      title: { en: "Winter Moss — Diva Flowers", es: "Musgo de Invierno — Diva Flowers" },
      description: {
        en: "Quiet winter arrangement with cedar, moss, and amaryllis. Same-day delivery on Long Island.",
        es: "Arreglo invernal sereno con cedro, musgo y amaryllis. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "x-card-premium",
    slug: "premium-card",
    title: { en: "Premium handwritten card", es: "Tarjeta escrita a mano premium" },
    category: "gifts",
    giftExtra: true,
    blurb: {
      en: "A note in Maky's hand, on heavy stock.",
      es: "Una nota escrita por Maky, en papel de gramaje alto.",
    },
    description: {
      en: "Hand-lettered by Maky on heavyweight cotton stock. Slipped into the arrangement at delivery.",
      es: "Escrita a mano por Maky en papel de algodón de alto gramaje. Se coloca en el arreglo al entregar.",
    },
    images: [{
      src: "/products/x-card-premium.jpg",
      alt: { en: "Handwritten card", es: "Tarjeta escrita a mano" },
      aspect: "1/1",
    }],
    variants: [{ id: "default", label: { en: "Premium card", es: "Tarjeta premium" }, priceCents: 500 }],
    tags: ["same-day"],
    occasions: ["just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Premium handwritten card | Diva Flowers", es: "Tarjeta escrita a mano premium | Diva Flowers" },
      description: { en: "Hand-lettered note added to your arrangement.", es: "Nota escrita a mano agregada a tu arreglo." },
    },
  },
  {
    id: "x-vase-upgrade",
    slug: "glass-vase-upgrade",
    title: { en: "Glass vase upgrade", es: "Mejora a jarrón de vidrio" },
    category: "gifts",
    giftExtra: true,
    blurb: {
      en: "Swap the standard vessel for hand-cut clear glass.",
      es: "Cambia el recipiente estándar por vidrio cortado a mano.",
    },
    description: {
      en: "Heavy clear-glass vase, hand-cut, sized to the arrangement.",
      es: "Jarrón pesado de vidrio transparente, cortado a mano, dimensionado al arreglo.",
    },
    images: [{
      src: "/products/x-vase-upgrade.jpg",
      alt: { en: "Glass vase", es: "Jarrón de vidrio" },
      aspect: "1/1",
    }],
    variants: [{ id: "default", label: { en: "Glass vase", es: "Jarrón de vidrio" }, priceCents: 1500 }],
    tags: ["same-day"],
    occasions: ["just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Glass vase upgrade | Diva Flowers", es: "Mejora a jarrón de vidrio | Diva Flowers" },
      description: { en: "Hand-cut clear glass vase upgrade.", es: "Mejora a jarrón de vidrio cortado a mano." },
    },
  },
  {
    id: "x-ribbon-silk",
    slug: "silk-ribbon",
    title: { en: "Silk ribbon", es: "Listón de seda" },
    category: "gifts",
    giftExtra: true,
    blurb: {
      en: "Hand-tied silk ribbon, color matched to the bouquet.",
      es: "Listón de seda atado a mano, combinado con el ramo.",
    },
    description: {
      en: "Sand-washed silk ribbon, tied at the stem by Maky.",
      es: "Listón de seda lavada a mano, atado al tallo por Maky.",
    },
    images: [{
      src: "/products/x-ribbon-silk.jpg",
      alt: { en: "Silk ribbon", es: "Listón de seda" },
      aspect: "1/1",
    }],
    variants: [{ id: "default", label: { en: "Silk ribbon", es: "Listón de seda" }, priceCents: 600 }],
    tags: ["same-day"],
    occasions: ["just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Silk ribbon | Diva Flowers", es: "Listón de seda | Diva Flowers" },
      description: { en: "Hand-tied silk ribbon for your arrangement.", es: "Listón de seda atado a mano para tu arreglo." },
    },
  },
  {
    id: "x-chocolates-mini",
    slug: "mini-chocolates",
    title: { en: "Mini chocolates (4 pieces)", es: "Mini chocolates (4 piezas)" },
    category: "gifts",
    giftExtra: true,
    blurb: {
      en: "Four single-origin chocolates from a Long Island chocolatier.",
      es: "Cuatro chocolates de origen único de un chocolatero de Long Island.",
    },
    description: {
      en: "Four hand-selected chocolates from our local chocolatier, packed alongside the arrangement.",
      es: "Cuatro chocolates seleccionados a mano de nuestro chocolatero local, empacados con el arreglo.",
    },
    images: [{
      src: "/products/x-chocolates-mini.jpg",
      alt: { en: "Mini chocolates", es: "Mini chocolates" },
      aspect: "1/1",
    }],
    variants: [{ id: "default", label: { en: "Mini chocolates", es: "Mini chocolates" }, priceCents: 800 }],
    tags: ["same-day"],
    occasions: ["just-because"],
    colorFamily: ["white"],
    active: true,
    seo: {
      title: { en: "Mini chocolates | Diva Flowers", es: "Mini chocolates | Diva Flowers" },
      description: { en: "Four-piece chocolate add-on from a Long Island chocolatier.", es: "Caja de cuatro chocolates de un chocolatero de Long Island." },
    },
  },
  {
    id: "p-bou-rose-red-wrap",
    slug: "wrapped-red-roses",
    title: { en: "Wrapped Red Roses", es: "Rosas Rojas Wrapped" },
    category: "bouquets",
    blurb: {
      en: "Twelve long-stem red roses, hand-tied and wrapped — the classic, done right.",
      es: "Doce rosas rojas de tallo largo, atadas a mano y envueltas — el clásico, hecho como debe ser.",
    },
    description: {
      en: "A dozen long-stem red roses, cut that morning and wrapped in matte paper — no plastic ribbon, no theatrics. The gift that says it was thought through before leaving the office. Add the ceramic base for the kind of arrangement that stays standing on the table all week. Order before 2pm and they go out today on Long Island.",
      es: "Una docena de rosas rojas de tallo largo, cortadas esa misma mañana y envueltas en papel mate — sin cinta plástica, sin floritura. El regalo que demuestra que fue pensado antes de salir de la oficina. Añade la base cerámica para que se mantenga firme en la mesa toda la semana. Pídelas antes de las 2pm y salen hoy mismo en Long Island.",
    },
    images: [
      {
        src: "/products/dozen-roses-bouquet.jpg",
        alt: { en: "Twelve red roses wrapped in matte paper, tied with cord", es: "Doce rosas rojas envueltas en papel mate, atadas con cordón" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "wrapped", label: { en: "Wrapped — 12 red roses", es: "Wrapped — 12 rosas rojas" }, priceCents: 8000 },
    ],
    addOns: [
      { id: "ceramic-base", label: { en: "Add ceramic base", es: "Añadir base cerámica" }, priceCents: 1500 },
    ],
    tags: ["new", "same-day", "staff-pick"],
    occasions: ["romance", "anniversary", "birthday", "congrats", "just-because"],
    colorFamily: ["red"],
    active: true,
    seo: {
      title: { en: "Wrapped Red Roses — Dozen Hand-Tied | Diva Flowers", es: "Rosas Rojas Wrapped — Docena Atada a Mano | Diva Flowers" },
      description: {
        en: "Twelve hand-tied red roses, paper wrapped. Optional ceramic base. Same-day delivery on Long Island.",
        es: "Doce rosas rojas atadas a mano y envueltas en papel. Base cerámica opcional. Entrega el mismo día en Long Island.",
      },
    },
  },
  {
    id: "p-bou-rose-color-wrap",
    slug: "wrapped-roses-colored",
    title: { en: "Wrapped Roses — Pick a Color", es: "Rosas Wrapped — Elige el Color" },
    category: "bouquets",
    blurb: {
      en: "A dozen roses in the color that suits the day — pink, yellow, white, or mixed.",
      es: "Una docena de rosas en el color que el día pida — rosadas, amarillas, blancas o mixtas.",
    },
    description: {
      en: "Twelve roses hand-tied and wrapped in matte paper, in the color you choose. Blush pink for the romance that takes its time, sunny yellow for the friend who needs a Tuesday, ivory white for the win you're celebrating, or mixed for the day that's all of it. Add the ceramic base for tabletop staying power. Same-day Long Island delivery on orders before 2pm.",
      es: "Una docena de rosas atadas a mano y envueltas en papel mate, en el color que elijas. Rosado pálido para el romance que se toma su tiempo, amarillo soleado para la amiga que necesita un martes, blanco marfil para las felicitaciones, o mixto para el día que es todo a la vez. Añade la base cerámica para que aguante en la mesa. Entrega el mismo día en Long Island antes de las 2pm.",
    },
    images: [
      {
        src: "/products/dozen-roses-in-pink.png",
        alt: { en: "Twelve pink roses wrapped in matte paper", es: "Doce rosas rosadas envueltas en papel mate" },
        aspect: "4/5",
      },
      {
        src: "/products/dozen-roses-in-yellow.png",
        alt: { en: "Twelve yellow roses wrapped in matte paper", es: "Doce rosas amarillas envueltas en papel mate" },
        aspect: "4/5",
      },
      {
        src: "/products/dozen-roses-in-white.png",
        alt: { en: "Twelve white roses wrapped in matte paper", es: "Doce rosas blancas envueltas en papel mate" },
        aspect: "4/5",
      },
      {
        src: "/products/dozen-roses-in-multi-color.jpg",
        alt: { en: "Twelve mixed-color roses wrapped in matte paper", es: "Doce rosas de colores mixtos envueltas en papel mate" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "pink", label: { en: "Pink (12)", es: "Rosadas (12)" }, priceCents: 6500 },
      { id: "yellow", label: { en: "Yellow (12)", es: "Amarillas (12)" }, priceCents: 6500 },
      { id: "white", label: { en: "White (12)", es: "Blancas (12)" }, priceCents: 6500 },
      { id: "mixed", label: { en: "Mixed (12)", es: "Mixtas (12)" }, priceCents: 6500 },
    ],
    addOns: [
      { id: "ceramic-base", label: { en: "Add ceramic base", es: "Añadir base cerámica" }, priceCents: 1500 },
    ],
    tags: ["new", "same-day"],
    occasions: ["birthday", "congrats", "just-because", "romance", "anniversary", "mothers-day"],
    colorFamily: ["pink", "white", "mixed"],
    active: true,
    seo: {
      title: { en: "Wrapped Roses by Color — Dozen Hand-Tied | Diva Flowers", es: "Rosas Wrapped por Color — Docena Atada a Mano | Diva Flowers" },
      description: {
        en: "Twelve hand-tied roses in your choice of color: pink, yellow, white, or mixed. Optional ceramic base. Same-day Long Island.",
        es: "Doce rosas atadas a mano en el color que elijas: rosado, amarillo, blanco o mixto. Base cerámica opcional. Mismo día en Long Island.",
      },
    },
  },
  // ─── TEST PRODUCT — $1 for end-to-end checkout validation. DELETE AFTER TESTING. ─────
  {
    id: "p-test-1usd",
    slug: "test-1-dollar",
    title: { en: "Test product — DO NOT BUY", es: "Producto de prueba — NO COMPRAR" },
    category: "gifts",
    giftExtra: true,
    blurb: {
      en: "Internal test product for end-to-end checkout validation. Not for customer purchase.",
      es: "Producto interno de prueba para validar el checkout. No para compra de clientes.",
    },
    description: {
      en: "Internal test product. If you see this on the live site, please contact support — it should not be reachable from the public catalog.",
      es: "Producto interno de prueba. Si lo ves en el sitio público, contacta a soporte — no debería ser accesible desde el catálogo.",
    },
    images: [
      {
        src: "https://picsum.photos/seed/test-1usd/1200/1500",
        alt: { en: "Test product placeholder", es: "Imagen de producto de prueba" },
        aspect: "4/5",
      },
    ],
    variants: [
      { id: "default", label: { en: "Default", es: "Predeterminado" }, priceCents: 100 },
    ],
    tags: [],
    occasions: [],
    colorFamily: [],
    active: true,
    seo: {
      title: { en: "Test product (internal)", es: "Producto de prueba (interno)" },
      description: { en: "Internal test product.", es: "Producto interno de prueba." },
    },
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(cat: string): Product[] {
  return PRODUCTS.filter((p) => p.active && !p.giftExtra && p.category === cat);
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
