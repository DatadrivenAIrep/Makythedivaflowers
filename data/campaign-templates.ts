// One-tap SMS campaign templates for the /admin/campaigns composer. Pure data
// (bilingual, like data/products.ts) — the bodies are content, not i18n. The owner
// taps a chip to fill the compose fields, then edits + sends. Do NOT include any
// opt-out/STOP text here; the sender appends the opt-out footer automatically.
// `{nombre}` is replaced with the customer's first name at send time.

export type CampaignTemplateCategory = "special_dates" | "seasonal" | "general";

export type CampaignTemplate = {
  id: string;
  category: CampaignTemplateCategory;
  icon: string; // Phosphor (ssr) icon name; mapped to a component in CampaignTemplates.tsx
  label: { es: string; en: string };
  bodyEs: string;
  bodyEn: string;
};

export const CAMPAIGN_TEMPLATE_CATEGORIES: {
  key: CampaignTemplateCategory;
  label: { es: string; en: string };
}[] = [
  { key: "special_dates", label: { es: "Fechas especiales", en: "Special dates" } },
  { key: "seasonal", label: { es: "Temporada", en: "Seasonal" } },
  { key: "general", label: { es: "Floristería", en: "Florist" } },
];

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "valentines",
    category: "special_dates",
    icon: "Heart",
    label: { es: "San Valentín", en: "Valentine's" },
    bodyEs:
      "¡Hola {nombre}! Que este San Valentín hable con flores 🌸 Ramos románticos, entrega el mismo día. 15% off si pides antes del 12 de feb.",
    bodyEn:
      "Hi {nombre}! Let this Valentine's speak in flowers 🌸 Romantic bouquets, same-day delivery. 15% off when you order before Feb 12.",
  },
  {
    id: "mothers_day",
    category: "special_dates",
    icon: "Flower",
    label: { es: "Día de la Madre", en: "Mother's Day" },
    bodyEs:
      "El Día de la Madre se dice con flores. Sorprende a mamá con un ramo fresco y entrega el mismo día. Reserva ya, los favoritos vuelan 💐",
    bodyEn:
      "Mother's Day is best said with flowers. Surprise mom with a fresh bouquet and same-day delivery. Reserve now, favorites go fast 💐",
  },
  {
    id: "fathers_day",
    category: "special_dates",
    icon: "Gift",
    label: { es: "Día del Padre", en: "Father's Day" },
    bodyEs:
      "Este Día del Padre, dile a papá cuánto vale con un arreglo especial hecho a mano. Entrega el mismo día. ¡Ordena hoy y ahorra 10%!",
    bodyEn:
      "This Father's Day, show dad he matters with a handcrafted arrangement made just for him. Same-day delivery. Order today and save 10%!",
  },
  {
    id: "birthday",
    category: "special_dates",
    icon: "Cake",
    label: { es: "Cumpleaños", en: "Birthday" },
    bodyEs:
      "¡Hola {nombre}! ¿Alguien especial cumple años? Alégrale el día con un ramo lleno de color y entrega el mismo día. Pídelo en minutos.",
    bodyEn:
      "Hi {nombre}! Someone special celebrating a birthday? Brighten their day with a colorful bouquet and same-day delivery. Order in minutes.",
  },
  {
    id: "christmas",
    category: "special_dates",
    icon: "Snowflake",
    label: { es: "Navidad", en: "Christmas" },
    bodyEs:
      "¡Hola {nombre}! La Navidad huele mejor con flores frescas. Centros de mesa y ramos festivos para tu hogar. 15% off esta semana.",
    bodyEn:
      "Hi {nombre}! Christmas smells better with fresh flowers. Festive centerpieces and bouquets for your home. 15% off this week.",
  },
  {
    id: "spring",
    category: "seasonal",
    icon: "FlowerTulip",
    label: { es: "Primavera", en: "Spring" },
    bodyEs:
      "¡Hola {nombre}! La primavera floreció en Diva Flowers 🌸 Ramos frescos de temporada, entrega el mismo día. ¿Te preparo uno?",
    bodyEn:
      "Hi {nombre}! Spring is blooming at Diva Flowers 🌸 Fresh seasonal bouquets, same-day delivery. Want one made just for you?",
  },
  {
    id: "summer",
    category: "seasonal",
    icon: "Sun",
    label: { es: "Verano", en: "Summer" },
    bodyEs:
      "Llegó el verano y sus flores más vibrantes. Ramos recién cortados que alegran cualquier día. Pídelos hoy, entrega el mismo día.",
    bodyEn:
      "Summer is here with its brightest blooms. Freshly cut bouquets that brighten any day. Order today for same-day delivery.",
  },
  {
    id: "fall",
    category: "seasonal",
    icon: "Leaf",
    label: { es: "Otoño", en: "Fall" },
    bodyEs:
      "El otoño llegó con sus tonos cálidos y arreglos de temporada. Dale calidez a tu mesa con flores frescas, entrega el mismo día.",
    bodyEn:
      "Fall is here with warm tones and cozy arrangements. Bring warmth to your table with fresh flowers, delivered today.",
  },
  {
    id: "weekly_bloom",
    category: "seasonal",
    icon: "FlowerLotus",
    label: { es: "Flor semanal", en: "Weekly bloom" },
    bodyEs:
      "La flor fresca de la semana ya está aquí 💐 Recién llegada y lista para regalar. Aparta la tuya hoy, entrega el mismo día.",
    bodyEn:
      "This week's fresh flower pick just arrived 💐 Freshly in and ready to gift. Reserve yours today with same-day delivery.",
  },
  {
    id: "weekend_deal",
    category: "general",
    icon: "Tag",
    label: { es: "Fin de semana", en: "Weekend deal" },
    bodyEs:
      "Este fin de semana, flores frescas con 15% de descuento. Pídelas hoy y alegra tu casa o la de alguien especial.",
    bodyEn:
      "This weekend only, fresh blooms are 15% off. Order today and brighten your home, or someone else's.",
  },
  {
    id: "same_day",
    category: "general",
    icon: "Truck",
    label: { es: "Mismo día", en: "Same-day" },
    bodyEs:
      "¿Se te pasó una fecha? Pide antes del mediodía y entregamos flores frescas el mismo día. Aún estás a tiempo.",
    bodyEn:
      "Forgot a date? Order before noon and we'll deliver fresh flowers the same day. There's still time.",
  },
  {
    id: "we_miss_you",
    category: "general",
    icon: "HandHeart",
    label: { es: "Te extrañamos", en: "We miss you" },
    bodyEs:
      "¡Te extrañamos, {nombre}! Vuelve esta semana y llévate 15% en tu próximo ramo. Te guardamos las flores más lindas.",
    bodyEn:
      "We miss you, {nombre}! Come back this week for 15% off your next bouquet. We've saved our prettiest blooms for you.",
  },
  {
    id: "treat_yourself",
    category: "general",
    icon: "Sparkle",
    label: { es: "Date un gusto", en: "Treat yourself" },
    bodyEs:
      "¡Hola {nombre}! Hoy te toca a ti. Llévate un ramo fresco solo porque sí, un poco de belleza para tu casa. Te lo mereces.",
    bodyEn:
      "Hi {nombre}! Today's about you. Pick up a fresh bouquet just because, a little beauty for your home. You deserve it.",
  },
  {
    id: "thank_you",
    category: "general",
    icon: "Star",
    label: { es: "Gracias", en: "Thank you" },
    bodyEs:
      "Gracias por confiar en nosotros, {nombre}. Tu cariño hace crecer esta familia. Pasa esta semana por un detalle de Maky 🌸",
    bodyEn:
      "Thank you for trusting us, {nombre}. Your love helps our little family grow. Come by this week for a treat from Maky 🌸",
  },
];
