import type { Locale } from "@/types/locale";
import type { Relation } from "@/schemas/card-message";

export type RelationMode = "default" | "sympathy";
export type RelationOption = { key: Relation; label: string };

const LABELS: Record<Locale, Record<Relation, string>> = {
  en: {
    partner: "Partner",
    mother: "Mom",
    father: "Dad",
    friend: "Friend",
    family: "Family",
    other: "Other",
    "close-friend": "Close friend",
    coworker: "Coworker",
  },
  es: {
    partner: "Pareja",
    mother: "Mamá",
    father: "Papá",
    friend: "Amigx",
    family: "Familia",
    other: "Otro",
    "close-friend": "Amistad cercana",
    coworker: "Compañerx de trabajo",
  },
};

const DEFAULT_KEYS: Relation[] = ["partner", "mother", "father", "friend", "family", "other"];
const SYMPATHY_KEYS: Relation[] = ["family", "close-friend", "coworker", "other"];

export function getRelations(mode: RelationMode, locale: Locale): RelationOption[] {
  const keys = mode === "sympathy" ? SYMPATHY_KEYS : DEFAULT_KEYS;
  return keys.map((key) => ({ key, label: LABELS[locale][key] }));
}
