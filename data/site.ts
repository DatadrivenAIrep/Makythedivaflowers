export const SITE = {
  brand: "Diva Flowers",
  merchantName: "Maky The Diva Flowers",
  url: "https://makythedivaflowers.com",
  founded: 2014,
  phone: "+1 (516) 484-3456",
  phoneDisplay: "516 484 3456",
  phoneHref: "tel:+15164843456",
  mobile: {
    display: "+1 (516) 851-2815",
    tel: "tel:+15168512815",
    e164: "+15168512815",
  },
  email: "studio@divaflowers.com",
  emailHref: "mailto:studio@divaflowers.com",
  address: {
    line1: "1077 Willis Ave",
    locality: "Albertson",
    region: "NY",
    postal: "11507",
    country: "USA",
  },
  geo: { lat: 40.7729367, lng: -73.6493681 },
  // Stable schema.org node ids — every JSON-LD block that describes the shop
  // points at the same @id so Google merges them into one entity instead of
  // reading two unrelated LocalBusinesses.
  ld: {
    businessId: "https://makythedivaflowers.com/#florist",
    websiteId: "https://makythedivaflowers.com/#website",
    orgId: "https://makythedivaflowers.com/#organization",
  },
  priceRange: "$$",
  map: {
    embedSrc: "https://maps.google.com/maps?q=1077+Willis+Ave%2C+Albertson%2C+NY+11507&t=m&z=16&output=embed",
    directionsHref: "https://www.google.com/maps/dir/?api=1&destination=1077+Willis+Ave%2C+Albertson%2C+NY+11507",
  },
  hours: [
    { day: "Mon–Fri", value: "9:00 AM – 7:00 PM", schema: "Mo-Fr 09:00-19:00" },
    { day: "Sat", value: "9:00 AM – 6:00 PM", schema: "Sa 09:00-18:00" },
    { day: "Sun", value: "10:00 AM – 4:00 PM", schema: "Su 10:00-16:00" },
  ],
  deliveryZones: ["Albertson", "Roslyn", "Manhasset", "Great Neck", "Port Washington", "and surrounding Long Island, Queens & western Suffolk areas"],
  // Towns we name explicitly in schema + on-page copy for local search.
  servedTowns: [
    "Albertson", "Roslyn", "Roslyn Heights", "Manhasset", "Great Neck",
    "Port Washington", "Williston Park", "Mineola", "Garden City",
    "Westbury", "New Hyde Park", "Carle Place", "Old Westbury",
    "Herricks", "Searingtown", "East Hills", "Glen Head", "Syosset",
  ],
  cutoffTime: "2:00 PM",
  cutoff24: "14:00",  // HH:mm format for parseCutoff/isSameDayEligible
  social: [
    { label: "Instagram", href: "https://instagram.com/divaflowersli" },
    { label: "TikTok", href: "https://www.tiktok.com/@makythediva" },
  ],
  recentDeliveries: [
    { city: "Garden City", time: "8 min ago" },
    { city: "Brentwood", time: "22 min ago" },
    { city: "Forest Hills", time: "41 min ago" },
    { city: "Mineola", time: "1 hr ago" },
    { city: "Bayside", time: "2 hr ago" },
  ],
  press: ["The Cut", "Vogue", "Brides", "New York Magazine", "Town & Country", "Refinery29"],
  tagline: {
    en: "Romance, by the stem.",
    es: "Romance, tallo a tallo.",
  },
  // The <title> is a search-results asset, not a brand asset: it leads with what
  // people actually type ("albertson ny florist", "same day flower delivery")
  // and closes with the brand. The tagline stays the on-page H1 — see Hero.
  metadata: {
    title: {
      en: "Albertson NY Florist | Same-Day Flower Delivery | Diva Flowers",
      es: "Floristería en Albertson NY | Flores a Domicilio el Mismo Día | Diva Flowers",
    },
    description: {
      en: "Maky The Diva Flowers is a local florist in Albertson, NY — same-day flower delivery, wedding flowers, sympathy and funeral arrangements, and custom design across Roslyn, Manhasset, Great Neck, Garden City and all of Nassau County.",
      es: "Maky The Diva Flowers es una floristería local en Albertson, NY — entrega de flores el mismo día, flores de boda, arreglos fúnebres y diseño floral personalizado en Roslyn, Manhasset, Great Neck, Garden City y todo Nassau County.",
    },
  },
  // Bilingual by design — the marquee is a single brand loop, not localized. See spec §5.1.
  marquee: {
    tokens: [
      "DIVA FLOWERS",
      "ROMANCE BY THE STEM",
      "LONG ISLAND",
      "DESDE 2014",
      "ENVÍOS HOY",
      "SAME-DAY DELIVERY",
    ],
  },
} as const;

export type SiteData = typeof SITE;
