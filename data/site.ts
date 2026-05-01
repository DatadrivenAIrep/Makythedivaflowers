export const SITE = {
  brand: "Diva Flowers",
  founded: 2014,
  phone: "+1 (516) 484-3456",
  phoneDisplay: "516 484 3456",
  phoneHref: "tel:+15164843456",
  email: "studio@divaflowers.com",
  emailHref: "mailto:studio@divaflowers.com",
  address: {
    line1: "1077 Hempstead Turnpike",
    locality: "Franklin Square",
    region: "NY",
    postal: "11010",
    country: "USA",
  },
  hours: [
    { day: "Mon–Fri", value: "9:00 AM – 7:00 PM" },
    { day: "Sat", value: "9:00 AM – 6:00 PM" },
    { day: "Sun", value: "10:00 AM – 4:00 PM" },
  ],
  deliveryZones: ["Nassau County", "Queens", "Brooklyn (select zip codes)", "Western Suffolk"],
  cutoffTime: "2:00 PM",
  social: [
    { label: "Instagram", href: "https://instagram.com/divaflowersli" },
    { label: "TikTok", href: "https://tiktok.com/@divaflowers" },
  ],
  recentDeliveries: [
    { city: "Garden City", time: "8 min ago" },
    { city: "Brentwood", time: "22 min ago" },
    { city: "Forest Hills", time: "41 min ago" },
    { city: "Mineola", time: "1 hr ago" },
    { city: "Bayside", time: "2 hr ago" },
  ],
  press: ["The Cut", "Vogue", "Brides", "New York Magazine", "Town & Country", "Refinery29"],
} as const;

export type SiteData = typeof SITE;
