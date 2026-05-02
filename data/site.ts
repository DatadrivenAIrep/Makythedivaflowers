export const SITE = {
  brand: "Diva Flowers",
  founded: 2014,
  phone: "+1 (516) 484-3456",
  phoneDisplay: "516 484 3456",
  phoneHref: "tel:+15164843456",
  mobile: {
    display: "+1 (516) 851-2815",
    tel: "tel:+15168512815",
    e164: "+15168512815",
  },
  email: "makythedivagalaevents@gmail.com",
  emailHref: "mailto:makythedivagalaevents@gmail.com",
  address: {
    line1: "1077 Willis Ave",
    locality: "Albertson",
    region: "NY",
    postal: "11507",
    country: "USA",
  },
  map: {
    embedSrc: "https://maps.google.com/maps?q=1077+Willis+Ave%2C+Albertson%2C+NY+11507&t=m&z=16&output=embed",
    directionsHref: "https://www.google.com/maps/dir/?api=1&destination=1077+Willis+Ave%2C+Albertson%2C+NY+11507",
  },
  hours: [
    { day: "Mon–Fri", value: "9:00 AM – 6:00 PM" },
    { day: "Sat", value: "9:00 AM – 5:00 PM" },
    { day: "Sun", value: "10:00 AM – 3:00 PM" },
  ],
  deliveryZones: ["Nassau County", "Queens", "Brooklyn (select zip codes)", "Western Suffolk"],
  cutoffTime: "2:00 PM",
  cutoff24: "14:00",  // HH:mm format for parseCutoff/isSameDayEligible
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
