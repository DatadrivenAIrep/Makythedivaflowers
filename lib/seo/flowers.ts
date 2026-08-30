import type { Locale } from "@/types/locale";

/**
 * Bilingual flower vocabulary, used to pull what is actually in an arrangement
 * out of its editorial copy.
 *
 * The catalog already names its stems — "purple lisianthus, white anemones and
 * silver dusty miller" — but only inside prose. Nothing structured knew a
 * product contained lisianthus, so 74 of 96 titles read "Amethyst Snowdrop"
 * with no flower, occasion or category in them at all. Nobody searches that.
 *
 * Extraction runs on the English copy and maps to Spanish, so the two locales
 * can never disagree about what a product contains.
 *
 * Longest names first — "garden rose" must win over "rose", "calla lily" over
 * "lily" — because the matcher takes the first hit and discards overlaps.
 */
export const FLOWERS: { en: string; es: string; label: { en: string; es: string } }[] = [
  { en: "bird of paradise", es: "ave del paraíso", label: { en: "Bird of Paradise", es: "Ave del Paraíso" } },
  { en: "bells of ireland", es: "campanas de irlanda", label: { en: "Bells of Ireland", es: "Campanas de Irlanda" } },
  { en: "cherry blossom", es: "flor de cerezo", label: { en: "Cherry Blossom", es: "Flor de Cerezo" } },
  { en: "baby's breath", es: "paniculata", label: { en: "Baby's Breath", es: "Paniculata" } },
  { en: "olive branch", es: "rama de olivo", label: { en: "Olive Branch", es: "Rama de Olivo" } },
  { en: "dusty miller", es: "dusty miller", label: { en: "Dusty Miller", es: "Dusty Miller" } },
  { en: "garden rose", es: "rosa de jardín", label: { en: "Garden Rose", es: "Rosa de Jardín" } },
  { en: "spray rose", es: "rosa spray", label: { en: "Spray Rose", es: "Rosa Spray" } },
  { en: "calla lily", es: "cala", label: { en: "Calla Lily", es: "Cala" } },
  { en: "phalaenopsis", es: "phalaenopsis", label: { en: "Phalaenopsis Orchid", es: "Orquídea Phalaenopsis" } },
  { en: "chrysanthemum", es: "crisantemo", label: { en: "Chrysanthemum", es: "Crisantemo" } },
  { en: "alstroemeria", es: "alstroemeria", label: { en: "Alstroemeria", es: "Alstroemeria" } },
  { en: "snapdragon", es: "boca de dragón", label: { en: "Snapdragon", es: "Boca de Dragón" } },
  { en: "delphinium", es: "delphinium", label: { en: "Delphinium", es: "Delphinium" } },
  { en: "ranunculus", es: "ranúnculo", label: { en: "Ranunculus", es: "Ranúnculo" } },
  { en: "hydrangea", es: "hortensia", label: { en: "Hydrangea", es: "Hortensia" } },
  { en: "lisianthus", es: "lisianthus", label: { en: "Lisianthus", es: "Lisianthus" } },
  { en: "eucalyptus", es: "eucalipto", label: { en: "Eucalyptus", es: "Eucalipto" } },
  { en: "gypsophila", es: "gypsophila", label: { en: "Gypsophila", es: "Gypsophila" } },
  { en: "waxflower", es: "waxflower", label: { en: "Waxflower", es: "Waxflower" } },
  { en: "amaranthus", es: "amaranto", label: { en: "Amaranthus", es: "Amaranto" } },
  { en: "gladiolus", es: "gladiolo", label: { en: "Gladiolus", es: "Gladiolo" } },
  { en: "hypericum", es: "hypericum", label: { en: "Hypericum", es: "Hypericum" } },
  { en: "anthurium", es: "anturio", label: { en: "Anthurium", es: "Anturio" } },
  { en: "sunflower", es: "girasol", label: { en: "Sunflower", es: "Girasol" } },
  { en: "carnation", es: "clavel", label: { en: "Carnation", es: "Clavel" } },
  { en: "cymbidium", es: "cymbidium", label: { en: "Cymbidium Orchid", es: "Orquídea Cymbidium" } },
  { en: "dendrobium", es: "dendrobium", label: { en: "Dendrobium Orchid", es: "Orquídea Dendrobium" } },
  { en: "heliconia", es: "heliconia", label: { en: "Heliconia", es: "Heliconia" } },
  { en: "narcissus", es: "narciso", label: { en: "Narcissus", es: "Narciso" } },
  { en: "gardenia", es: "gardenia", label: { en: "Gardenia", es: "Gardenia" } },
  { en: "tuberose", es: "nardo", label: { en: "Tuberose", es: "Nardo" } },
  { en: "cattleya", es: "cattleya", label: { en: "Cattleya Orchid", es: "Orquídea Cattleya" } },
  { en: "scabiosa", es: "escabiosa", label: { en: "Scabiosa", es: "Escabiosa" } },
  { en: "craspedia", es: "craspedia", label: { en: "Craspedia", es: "Craspedia" } },
  { en: "larkspur", es: "espuela de caballero", label: { en: "Larkspur", es: "Espuela de Caballero" } },
  { en: "magnolia", es: "magnolia", label: { en: "Magnolia", es: "Magnolia" } },
  { en: "hyacinth", es: "jacinto", label: { en: "Hyacinth", es: "Jacinto" } },
  { en: "daffodil", es: "narciso", label: { en: "Daffodil", es: "Narciso" } },
  { en: "marigold", es: "caléndula", label: { en: "Marigold", es: "Caléndula" } },
  { en: "veronica", es: "verónica", label: { en: "Veronica", es: "Verónica" } },
  { en: "camellia", es: "camelia", label: { en: "Camellia", es: "Camelia" } },
  { en: "freesia", es: "fresia", label: { en: "Freesia", es: "Fresia" } },
  { en: "gerbera", es: "gerbera", label: { en: "Gerbera", es: "Gerbera" } },
  { en: "astilbe", es: "astilbe", label: { en: "Astilbe", es: "Astilbe" } },
  { en: "statice", es: "statice", label: { en: "Statice", es: "Statice" } },
  { en: "thistle", es: "cardo", label: { en: "Thistle", es: "Cardo" } },
  { en: "protea", es: "protea", label: { en: "Protea", es: "Protea" } },
  { en: "anemone", es: "anémona", label: { en: "Anemone", es: "Anémona" } },
  { en: "peonies", es: "peonías", label: { en: "Peony", es: "Peonía" } },
  { en: "peony", es: "peonía", label: { en: "Peony", es: "Peonía" } },
  { en: "orchid", es: "orquídea", label: { en: "Orchid", es: "Orquídea" } },
  { en: "dahlia", es: "dalia", label: { en: "Dahlia", es: "Dalia" } },
  { en: "celosia", es: "celosía", label: { en: "Celosia", es: "Celosía" } },
  { en: "allium", es: "allium", label: { en: "Allium", es: "Allium" } },
  { en: "cosmos", es: "cosmos", label: { en: "Cosmos", es: "Cosmos" } },
  { en: "zinnia", es: "zinnia", label: { en: "Zinnia", es: "Zinnia" } },
  { en: "lilies", es: "lirios", label: { en: "Lily", es: "Lirio" } },
  { en: "tulip", es: "tulipán", label: { en: "Tulip", es: "Tulipán" } },
  { en: "stock", es: "alhelí", label: { en: "Stock", es: "Alhelí" } },
  { en: "aster", es: "aster", label: { en: "Aster", es: "Aster" } },
  { en: "poppy", es: "amapola", label: { en: "Poppy", es: "Amapola" } },
  { en: "ruscus", es: "ruscus", label: { en: "Ruscus", es: "Ruscus" } },
  { en: "lily", es: "lirio", label: { en: "Lily", es: "Lirio" } },
  { en: "iris", es: "iris", label: { en: "Iris", es: "Iris" } },
  { en: "rose", es: "rosa", label: { en: "Rose", es: "Rosa" } },
  { en: "fern", es: "helecho", label: { en: "Fern", es: "Helecho" } },
];

/** Stems that support a design but should never headline a title. */
const FILLER = new Set([
  "Dusty Miller", "Eucalyptus", "Ruscus", "Fern", "Gypsophila", "Baby's Breath",
  "Waxflower", "Statice", "Hypericum", "Olive Branch", "Bells of Ireland",
]);

export type FlowerHit = { label: { en: string; es: string }; at: number };

/** Flowers named in `text`, in the order the copy names them. */
export function extractFlowers(text: string): FlowerHit[] {
  const low = text.toLowerCase();
  const hits: FlowerHit[] = [];
  for (const f of FLOWERS) {
    const at = low.indexOf(f.en);
    if (at === -1) continue;
    // A longer name already claimed this text ("garden rose" vs "rose").
    if (hits.some((h) => h.label.en === f.label.en)) continue;
    if (hits.some((h) => h.at <= at && at < h.at + h.label.en.length + 8)) continue;
    hits.push({ label: f.label, at });
  }
  return hits.sort((a, b) => a.at - b.at);
}

/** The stems worth naming in a title — headline blooms, not greenery. */
export function headlineFlowers(text: string, max = 2): FlowerHit[] {
  const all = extractFlowers(text);
  const headline = all.filter((f) => !FILLER.has(f.label.en));
  const pool = headline.length ? headline : all;

  // "Phalaenopsis Orchid & Orchid" — a bare head noun adds nothing next to a
  // named variety of itself. Keep the specific one.
  const specific = pool.filter(
    (f) =>
      !pool.some(
        (o) => o !== f && o.label.en !== f.label.en && o.label.en.endsWith(` ${f.label.en}`),
      ),
  );
  return specific.slice(0, max);
}

export function joinFlowers(hits: FlowerHit[], locale: Locale): string {
  const names = hits.map((h) => h.label[locale]);
  if (names.length <= 1) return names[0] ?? "";

  // Two orchid varieties read as "Phalaenopsis Orchid & Cymbidium Orchid".
  // Factor the shared head noun out: "Phalaenopsis & Cymbidium Orchid" in
  // English, "Orquídea Phalaenopsis y Cymbidium" in Spanish, where the noun
  // leads instead of trailing.
  const head = (n: string) => (locale === "es" ? n.split(" ")[0] : n.split(" ").at(-1)!);
  const shared = names.every((n) => n.includes(" ") && head(n) === head(names[0]));
  const shown = shared
    ? names.map((n) =>
        locale === "es" ? n.split(" ").slice(1).join(" ") : n.split(" ").slice(0, -1).join(" "),
      )
    : names;

  const joined =
    locale === "es"
      ? `${shown.slice(0, -1).join(", ")} y ${shown.at(-1)}`
      : `${shown.slice(0, -1).join(", ")} & ${shown.at(-1)}`;

  if (!shared) return joined;
  return locale === "es" ? `${head(names[0])} ${joined}` : `${joined} ${head(names[0])}`;
}

/**
 * Does `text` name a flower in this locale?
 *
 * `extractFlowers` matches English source copy. Checking a Spanish *title* with
 * it silently returns nothing, which made a catalog audit report 63 flowerless
 * titles that were fine — the Spanish half were all false positives.
 */
export function namesFlower(text: string, locale: Locale): boolean {
  const low = text.toLowerCase();
  return FLOWERS.some((f) => low.includes(f[locale]) || low.includes(f.label[locale].toLowerCase()));
}
