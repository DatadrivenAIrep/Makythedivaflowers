// Fixed lists for "what they like": no free text, so nobody can type health data.
export const FLOWERS = [
  "roses", "hydrangeas", "peonies", "tulips", "sunflowers",
  "orchids", "lilies", "carnations", "gerberas", "lisianthus",
] as const;
export type FlowerCode = (typeof FLOWERS)[number];

export const COLORS = ["red", "pink", "white", "lavender", "yellow", "orange", "pastel"] as const;
export type ColorCode = (typeof COLORS)[number];

export const AVOID = [...FLOWERS, "strong_scent", "heavy_pollen"] as const;
export type AvoidCode = (typeof AVOID)[number];

type Locale = "es" | "en";

// Wording used inside SMS text (button labels live in messages/*.json).
const FLOWER_SMS: Record<FlowerCode, Record<Locale, string>> = {
  roses: { es: "rosas", en: "roses" },
  hydrangeas: { es: "hortensias", en: "hydrangeas" },
  peonies: { es: "peonías", en: "peonies" },
  tulips: { es: "tulipanes", en: "tulips" },
  sunflowers: { es: "girasoles", en: "sunflowers" },
  orchids: { es: "orquídeas", en: "orchids" },
  lilies: { es: "lirios", en: "lilies" },
  carnations: { es: "claveles", en: "carnations" },
  gerberas: { es: "gerberas", en: "gerberas" },
  lisianthus: { es: "lisianthus", en: "lisianthus" },
};

const COLOR_SMS: Record<ColorCode, Record<Locale, string>> = {
  red: { es: "rojos", en: "red" },
  pink: { es: "rosados", en: "pink" },
  white: { es: "blancos", en: "white" },
  lavender: { es: "lavanda", en: "lavender" },
  yellow: { es: "amarillos", en: "yellow" },
  orange: { es: "naranjas", en: "orange" },
  pastel: { es: "pastel", en: "pastel" },
};

export function flowersPhrase(
  flower: FlowerCode | undefined,
  color: ColorCode | undefined,
  locale: Locale,
): string | null {
  const f = flower ? FLOWER_SMS[flower][locale] : null;
  const c = color ? COLOR_SMS[color][locale] : null;
  if (locale === "es") {
    if (f && c) return `${f} en tonos ${c}`;
    if (f) return f;
    return c ? `flores en tonos ${c}` : null;
  }
  if (f && c) return `${c} ${f}`;
  if (f) return f;
  return c ? `${c} flowers` : null;
}
