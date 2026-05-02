// data/reviews.ts

export type Review = {
  id: string;
  author: string;
  initials: string;
  rating: 5;
  occasion?: string;
  date: string;                          // ISO YYYY-MM, absolute
  text: { en: string; es: string };
  originalLang: "en" | "es";
};

export type ReviewsAggregate = {
  rating: number;
  total: number;
  placeUrl: string;
};

export const REVIEWS_AGGREGATE = {
  rating: 4.9,
  total: 127,
  placeUrl: "https://g.page/r/REPLACE_WITH_REAL_PLACE_URL",
} as const;

export function buildReviewsJsonLd(
  reviews: Review[],
  aggregate: ReviewsAggregate,
  brandName: string,
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: brandName,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: aggregate.rating,
      reviewCount: aggregate.total,
    },
    review: reviews.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      datePublished: r.date,
      reviewBody: r.text.en,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
    })),
  });
}

export const REVIEWS: Review[] = [
  {
    id: "blanca-duarte-martini-2025-12",
    author: "Blanca Duarte Martini",
    initials: "BD",
    rating: 5,
    occasion: "Boda",
    date: "2025-12",
    text: {
      en: "Maky was available in the nick of time! I had ordered my daughter's bridal bouquet at a different place only to be disappointed when it looked like the bouquet was days old and looked terrible! She created a beautiful arrangement with different color flowers that complemented her dress. She was very knowledgeable about design and even created a corsage for the groom. You will be our preferred florist from now on!",
      es: "¡Maky estuvo disponible justo a tiempo! Había pedido el ramo de novia de mi hija en otro lugar y me decepcioné cuando llegó como si tuviera días y lucía terrible. Creó un arreglo hermoso con flores de diferentes colores que complementaban su vestido. Era muy experta en diseño e incluso creó una boutonnière para el novio. ¡Serás nuestra florista preferida de ahora en adelante!",
    },
    originalLang: "en",
  },
  {
    id: "jonathan-webb-2026-03",
    author: "Jonathan Webb",
    initials: "JW",
    rating: 5,
    occasion: "Cumpleaños",
    date: "2026-03",
    text: {
      en: "Maky makes the most creative and beautiful flower arrangements! My wife doesn't like to waste money on flowers, however every time I go there I leave it in the hands of Maky and she never disappoints! I highly recommend letting her do her thing! Thanks again for making my wife's 50th special!",
      es: "¡Maky hace los arreglos florales más creativos y hermosos! A mi esposa no le gusta gastar en flores, pero cada vez que voy dejo todo en manos de Maky y nunca decepciona. ¡Recomiendo ampliamente dejarla hacer su magia! ¡Gracias por hacer especial el 50 cumpleaños de mi esposa!",
    },
    originalLang: "en",
  },
  {
    id: "linda-arellano-2026-01",
    author: "Linda Arellano",
    initials: "LA",
    rating: 5,
    date: "2026-01",
    text: {
      en: "The best flower shop in town. Maky provides excellent customer service, shares her amazing ideas if you're clueless of what you're looking for, delivery is always on time. Maky does the most beautiful flower arrangements for gifts or any special occasion. Maky & her team always give the best to make clients happy ♥️",
      es: "La mejor florería de la ciudad. Maky brinda un excelente servicio al cliente, comparte sus increíbles ideas cuando no sabes qué buscar, la entrega siempre llega puntual. Maky hace los arreglos florales más hermosos para regalos o cualquier ocasión especial. Maky y su equipo siempre dan lo mejor para hacer felices a sus clientes ♥️",
    },
    originalLang: "en",
  },
  {
    id: "samantha-brown-2026-03",
    author: "Samantha Brown",
    initials: "SB",
    rating: 5,
    occasion: "Boda",
    date: "2026-03",
    text: {
      en: "Maky was amazing! She made my wedding day look so beautiful. Everything I was imagining she made possible. The flowers and decorations looked amazing. She is a professional and always comes prepared. Her and her team worked seamlessly and so fast! Thank you Maky and the Diva Florist team.",
      es: "¡Maky fue increíble! Hizo que mi día de boda luciera tan hermoso. Todo lo que imaginaba, ella lo hizo posible. Las flores y decoraciones quedaron espectaculares. Es muy profesional y siempre viene preparada. Ella y su equipo trabajaron de forma impecable y muy rápida. ¡Gracias Maky y al equipo de Diva Florist!",
    },
    originalLang: "en",
  },
  {
    id: "charlotte-silagyi-2025-05",
    author: "Charlotte Silagyi",
    initials: "CS",
    rating: 5,
    date: "2025-05",
    text: {
      en: "The most beautiful flowers I have ever received has been from Diva's! Everyone is so friendly and kind! They make ordering flowers so easy. You can tell with every bouquet I have received from them they put hard work and all their love into it. Thank you Diva!",
      es: "¡Las flores más hermosas que he recibido han sido de Diva! ¡Todos son muy amables y atentos! Hacen que ordenar flores sea muy fácil. Con cada ramo se nota que ponen mucho trabajo y amor. ¡Gracias Diva!",
    },
    originalLang: "en",
  },
  {
    id: "rosa-cirrincione-2025-05",
    author: "Rosa Cirrincione",
    initials: "RC",
    rating: 5,
    date: "2025-05",
    text: {
      en: "I've been a long time client of Diva Florist and I would highly recommend this business for all your floral needs. Maky the floral designer is extremely creative, kind and reliable. I have referred Diva Florist to all of my family and friends because I know that the flowers and designs are top quality. Thank you Diva Florist!",
      es: "Soy cliente de Diva Florist desde hace mucho tiempo y los recomendaría ampliamente para todas tus necesidades florales. Maky, la diseñadora floral, es extremadamente creativa, amable y confiable. He referido a Diva Florist a toda mi familia y amigos porque sé que las flores y los diseños son de primera calidad. ¡Gracias Diva Florist!",
    },
    originalLang: "en",
  },
  {
    id: "suedeh-ranjbar-2025-06",
    author: "Suedeh Ranjbar",
    initials: "SR",
    rating: 5,
    date: "2025-06",
    text: {
      en: "This is the best flower shop I've ever been to. Not only are their flowers fresh and beautiful, but the way they arrange and wrap them is unlike any other flower shop. Their prices are reasonable and everyone who works here is extremely kind. Do yourself a favor and COME HERE FOR ALL YOUR OCCASIONS! TRUST ME!",
      es: "Esta es la mejor florería a la que he ido. No solo sus flores son frescas y hermosas, sino que la forma en que las arreglan y envuelven es diferente a cualquier otra. Sus precios son razonables y todos son extremadamente amables. ¡Hazte un favor y VEN AQUÍ PARA TODAS TUS OCASIONES! ¡CONFÍA EN MÍ!",
    },
    originalLang: "en",
  },
];
