import type { ShopSlug } from "@/lib/shop-categories";

/**
 * The paragraph under each shop category grid.
 *
 * Why it exists: a category page was a one-line intro and a grid of photos, so
 * Google had almost no text to rank it for ("rose delivery nassau county") and
 * left three of these hubs unindexed (Search Console, 2026-11).
 *
 * Rules for editing:
 *  - Describe what is actually in the category. Counts and the "from $" price
 *    are NOT written here: the page computes them from the live catalog.
 *  - No operational promise the shop has not confirmed. The same-day cutoff is
 *    injected from SITE.cutoffTime via the {cutoff} token, never typed by hand.
 *  - Each paragraph must be its own text. Reusing one paragraph across
 *    categories is what makes Google treat the pages as duplicates.
 */
export const SHOP_CATEGORY_COPY: Partial<
  Record<ShopSlug, { heading: { en: string; es: string }; body: { en: string; es: string } }>
> = {
  arrangements: {
    heading: {
      en: "Flower arrangements, delivered across Nassau County",
      es: "Arreglos florales a domicilio en Nassau County",
    },
    body: {
      en: "Every arrangement here is designed and built by hand in our Albertson studio on Willis Avenue and arrives in its vase or container, ready to set down — nothing to trim, nothing to arrange. The collection runs from compact desk-sized pieces to tall statement designs with roses, lilies, hydrangea, orchids and seasonal stems. Pieces marked same-day go out today when you order by {cutoff}, to Roslyn, Manhasset, Great Neck, Garden City, Mineola and the rest of Nassau County. Want different colors or a specific flower? Call or text and Maky will design it for you.",
      es: "Cada arreglo se diseña y se arma a mano en nuestro estudio de Albertson, en Willis Avenue, y llega en su florero o base, listo para colocar: sin recortar tallos ni acomodar nada. La colección va desde piezas compactas para un escritorio hasta diseños altos de gran presencia con rosas, lirios, hortensias, orquídeas y flores de temporada. Las piezas marcadas «mismo día» salen hoy si ordenas antes de las {cutoff}, hacia Roslyn, Manhasset, Great Neck, Garden City, Mineola y el resto de Nassau County. ¿Quieres otros colores o una flor en particular? Llama o escribe y Maky lo diseña para ti.",
    },
  },
  bouquets: {
    heading: {
      en: "Hand-tied bouquets from a local Albertson florist",
      es: "Ramos atados a mano por una florista local de Albertson",
    },
    body: {
      en: "A bouquet is the gift you hand over yourself: stems gathered and tied by hand, wrapped in paper, meant to be carried in through the door. Ours are cut and wrapped the morning they leave the studio, so the flowers open at home rather than in a cooler. You will find garden-style mixes, soft pastels, bright mixed colors and classic wrapped roses, in several sizes. Bouquets marked same-day are delivered today on orders placed by {cutoff} anywhere in Nassau County, or you can pick yours up at the shop in Albertson.",
      es: "Un ramo es el regalo que entregas en persona: tallos reunidos y atados a mano, envueltos en papel, hechos para llegar en brazos. Los nuestros se cortan y se envuelven la misma mañana en que salen del estudio, para que las flores abran en casa y no en una nevera. Encontrarás mezclas estilo jardín, tonos pastel, combinaciones de colores vivos y las clásicas rosas envueltas, en varios tamaños. Los ramos marcados «mismo día» se entregan hoy si ordenas antes de las {cutoff} en cualquier punto de Nassau County, o puedes recoger el tuyo en la tienda de Albertson.",
    },
  },
  roses: {
    heading: {
      en: "Rose delivery in Nassau County, from one dozen to one hundred",
      es: "Rosas a domicilio en Nassau County, desde una docena hasta cien",
    },
    body: {
      en: "Roses are what we are asked for most, so this is the widest part of the shop: wrapped dozens, two and three dozen in a vase, mixed designs where roses lead, and the showpieces — one hundred roses in a vase or a basket. Red is the classic for anniversaries and Valentine's Day; pink, white and mixed colors are here too. Each order is built the morning of delivery, not pulled from a shelf. Designs marked same-day reach Roslyn, Manhasset, Great Neck, Garden City and all of Nassau County today when ordered by {cutoff}.",
      es: "Las rosas son lo que más nos piden, así que esta es la parte más amplia de la tienda: docenas envueltas, dos y tres docenas en florero, diseños mixtos donde la rosa es protagonista y las piezas de impacto: cien rosas en florero o en canasta. El rojo es el clásico para aniversarios y San Valentín; también hay rosado, blanco y colores mixtos. Cada pedido se arma la mañana de la entrega, no se saca de un estante. Los diseños marcados «mismo día» llegan hoy a Roslyn, Manhasset, Great Neck, Garden City y todo Nassau County si ordenas antes de las {cutoff}.",
    },
  },
  exotic: {
    heading: {
      en: "Exotic and tropical flower arrangements on Long Island",
      es: "Arreglos de flores exóticas y tropicales en Long Island",
    },
    body: {
      en: "This is the part of the studio that looks least like a traditional flower shop. These designs are built around tropical and unusual stems — cymbidium and phalaenopsis orchids, birds of paradise, heliconia, ginger, anthurium, protea, monstera leaves — arranged for shape and height as much as for color. They tend to last longer than a garden bouquet and suit a home entry, an office reception or a gift for someone who already has everything. Most are available same-day across Nassau County when ordered by {cutoff}; tell us the space and we can scale a design up for an event.",
      es: "Esta es la parte del estudio que menos se parece a una floristería tradicional. Son diseños construidos con tallos tropicales y poco comunes: orquídeas cymbidium y phalaenopsis, aves del paraíso, heliconias, ginger, anturios, proteas, hojas de monstera, pensados tanto por su forma y altura como por su color. Suelen durar más que un ramo de jardín y quedan bien en la entrada de una casa, la recepción de una oficina o como regalo para quien ya lo tiene todo. La mayoría está disponible el mismo día en Nassau County si ordenas antes de las {cutoff}; cuéntanos el espacio y adaptamos el tamaño para un evento.",
    },
  },
  centerpieces: {
    heading: {
      en: "Table centerpieces for dinners, showers and celebrations",
      es: "Centros de mesa para cenas, showers y celebraciones",
    },
    body: {
      en: "A centerpiece has one job a bouquet does not: guests need to see each other across it. These are designed low and full for that reason, with long-table and multi-vase options for larger settings. They work for holiday dinners, bridal and baby showers, birthdays, communions and corporate lunches. Order a single piece for the dining table or tell us how many tables you are setting and we will match them. Delivery runs across Nassau County; for a party, we suggest ordering a few days ahead so we can reserve the flowers.",
      es: "Un centro de mesa tiene una tarea que un ramo no tiene: los invitados deben poder verse por encima de él. Por eso se diseñan bajos y llenos, con opciones para mesas largas y conjuntos de varios floreros para montajes más grandes. Sirven para cenas de fiestas, bridal y baby showers, cumpleaños, primeras comuniones y almuerzos corporativos. Pide una sola pieza para el comedor o dinos cuántas mesas vas a montar y las hacemos a juego. Entregamos en todo Nassau County; para una fiesta, recomendamos ordenar con unos días de anticipación para reservar las flores.",
    },
  },
  fall: {
    heading: {
      en: "Fall and Thanksgiving flowers, delivered in Nassau County",
      es: "Flores de otoño y Thanksgiving a domicilio en Nassau County",
    },
    body: {
      en: "The autumn collection is built in harvest colors — burnt orange, gold, deep red and plum — using roses, sunflowers, mums and textured seasonal accents such as wheat and mini pumpkins. Most pieces are sized for a Thanksgiving table or a kitchen island; a few are larger statement designs for an entry or a buffet. If you are a guest, a fall arrangement is an easy thing to send ahead to the host. Thanksgiving week fills quickly, so order early and choose your delivery day at checkout.",
      es: "La colección de otoño se arma en colores de cosecha: naranja quemado, dorado, rojo profundo y ciruela, con rosas, girasoles, crisantemos y detalles de temporada con textura como trigo y mini calabazas. La mayoría de las piezas tiene el tamaño justo para la mesa de Thanksgiving o la isla de la cocina; algunas son diseños más grandes para una entrada o un bufé. Si vas de invitado, un arreglo de otoño es un detalle fácil de enviar por adelantado a los anfitriones. La semana de Thanksgiving se llena rápido: ordena con tiempo y elige el día de entrega al pagar.",
    },
  },
  christmas: {
    heading: {
      en: "Christmas flowers and holiday arrangements",
      es: "Flores de Navidad y arreglos para las fiestas",
    },
    body: {
      en: "Our Christmas designs keep to the colors of the season: red roses, white blooms and evergreen, finished with festive accents. They are made for the holiday table, the mantel or the front hall, and they travel well as a gift to family, a host or a client. The collection grows through December as holiday stems arrive, so check back or call the shop if you have something specific in mind. We deliver across Nassau County; for Christmas week, place your order early to hold your delivery day.",
      es: "Nuestros diseños de Navidad se mantienen en los colores de la temporada: rosas rojas, flores blancas y verde pino, con detalles festivos. Están hechos para la mesa de las fiestas, la repisa de la chimenea o el recibidor, y funcionan muy bien como regalo para la familia, los anfitriones o un cliente. La colección crece durante diciembre a medida que llegan las flores de temporada: vuelve a mirar o llama a la tienda si tienes algo específico en mente. Entregamos en todo Nassau County; para la semana de Navidad, ordena con tiempo para asegurar tu día de entrega.",
    },
  },
  valentines: {
    heading: {
      en: "Valentine's Day roses and flowers, delivered February 14",
      es: "Rosas y flores de San Valentín, entregadas el 14 de febrero",
    },
    body: {
      en: "For Valentine's Day we put together two kinds of gift. The first is the classic: red roses by the dozen, rose hearts and romantic mixed designs. The second is for someone who would rather not get what everyone else gets — orchids, callas and tropical stems in sculptural arrangements. February 14 is the busiest delivery day of the year for any florist, so the earlier you order, the better your choice of design and delivery window. We deliver to homes and workplaces across Nassau County.",
      es: "Para San Valentín preparamos dos tipos de regalo. El primero es el clásico: rosas rojas por docena, corazones de rosas y diseños mixtos románticos. El segundo es para quien prefiere no recibir lo mismo que todos: orquídeas, calas y flores tropicales en arreglos escultóricos. El 14 de febrero es el día con más entregas del año para cualquier floristería, así que cuanto antes ordenes, más opciones tendrás de diseño y de horario de entrega. Entregamos en casas y lugares de trabajo en todo Nassau County.",
    },
  },
  plants: {
    heading: {
      en: "Orchids and plants that keep going after the flowers would not",
      es: "Orquídeas y plantas que siguen ahí cuando las flores ya no",
    },
    body: {
      en: "A plant is the right gift when you want it to last: a phalaenopsis orchid blooms for weeks and, with a little light and water, flowers again. Ours come potted in a planter and ready to display, with nothing to repot. They are a good choice for a new home, an office, a get-well wish or a sympathy gesture that the family can keep. We deliver across Nassau County, same-day on orders placed by {cutoff}. Looking for a larger orchid garden or a specific color? Call the shop and we will put one together.",
      es: "Una planta es el regalo indicado cuando quieres que dure: una orquídea phalaenopsis florece durante semanas y, con algo de luz y agua, vuelve a florecer. Las nuestras llegan en su macetero, listas para exhibir, sin necesidad de trasplantar. Son una buena opción para un hogar nuevo, una oficina, un deseo de pronta recuperación o un gesto de condolencia que la familia puede conservar. Entregamos en todo Nassau County, el mismo día si ordenas antes de las {cutoff}. ¿Buscas un jardín de orquídeas más grande o un color específico? Llama a la tienda y lo preparamos.",
    },
  },
  gifts: {
    heading: {
      en: "Flower gift baskets and sets",
      es: "Canastas y regalos con flores",
    },
    body: {
      en: "When flowers alone are not quite the whole gift, these are the sets we build around them: baskets and parcels that combine fresh blooms with something extra, put together in the studio and delivered as one present. They suit a thank-you, a new baby, a housewarming or a client gift. If you cannot decide, Designer's Choice lets Maky pick the best stems in the cooler that morning for the budget you set. All of them are available same-day across Nassau County when ordered by {cutoff}.",
      es: "Cuando las flores solas no terminan de ser el regalo completo, estos son los conjuntos que armamos alrededor de ellas: canastas y paquetes que combinan flores frescas con un detalle adicional, preparados en el estudio y entregados como un solo regalo. Van bien para dar las gracias, un recién nacido, una casa nueva o un regalo para un cliente. Si no te decides, Designer's Choice deja que Maky elija esa mañana las mejores flores disponibles para el presupuesto que indiques. Todos están disponibles el mismo día en Nassau County si ordenas antes de las {cutoff}.",
    },
  },
};
