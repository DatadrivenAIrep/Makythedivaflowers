// Reads a florist order's card message and says whether it announces a
// birthday or anniversary. Pure: no database, no framework imports.
import type { RelationshipCode } from "@/lib/customer-dates";

export type CardReading =
  | { result: "date"; kind: "birthday" | "anniversary"; relationship?: RelationshipCode; years?: number }
  | { result: "review"; relationship?: RelationshipCode; years?: number }
  | { result: "memorial" }
  | { result: "none" };

// Lowercase, no accents, whitespace (incl. newlines) collapsed to one space.
function normalize(message: string): string {
  return message.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const MEMORIAL =
  /heaven|rest in peace|\brip\b|descanse|descansa en paz|\ben paz\b|in memory|en memoria|condolen|sympathy|pesame|\b(?:en el|desde el|al|hasta el) cielo\b/;
const BIRTHDAY = /\b(?:birthday|b-?day|cumple\w*)\b/;
const ANNIVERSARY = /\b(?:anniversary|aniversario)\b/;

// Years: first number found in any of the three shapes.
const YEAR_SHAPES = [
  /\b(?:happy|feliz|felices) (\d{1,3})(?:st|nd|rd|th)?\b/,
  /\b(\d{1,3})(?:st|nd|rd|th) (?:birthday|bday|b-day|anniversary)\b/,
  /\b(\d{1,3}) (?:years?|anos?)\b/,
];

function readYears(text: string): number | undefined {
  let best: { index: number; value: number } | undefined;
  for (const shape of YEAR_SHAPES) {
    const m = shape.exec(text);
    if (m && (!best || m.index < best.index)) best = { index: m.index, value: Number(m[1]) };
  }
  return best?.value;
}

type Language = {
  phrase: string; // the greeting + occasion
  possessive: string; // words that can sit between the phrase and the relative
  filler: string; // "my"-like words that also anchor a relative anywhere
  words: Record<string, RelationshipCode>;
};

const ENGLISH: Language = {
  phrase: "happy (?:birthday|bday|b-day|anniversary)",
  possessive: "to|my|our|dear|beautiful",
  filler: "my",
  words: {
    mom: "madre", mommy: "madre", mother: "madre", mama: "madre", mami: "madre", mum: "madre",
    dad: "padre", daddy: "padre", father: "padre", papa: "padre", papi: "padre",
    wife: "esposa", husband: "esposo", hubby: "esposo", daughter: "hija", son: "hijo",
    sister: "hermana", brother: "hermano",
    grandma: "abuela", granny: "abuela", grandmother: "abuela", nana: "abuela",
    grandpa: "abuelo", grandfather: "abuelo",
    aunt: "tia", auntie: "tia", titi: "tia", uncle: "tio",
    girlfriend: "novia", boyfriend: "novio",
  },
};

const SPANISH: Language = {
  phrase: "feliz (?:cumple\\w*|aniversario)",
  possessive: "para|mi|nuestra|nuestro|querida|querido|hermosa|bella",
  filler: "mi",
  words: {
    mama: "madre", mami: "madre", mamita: "madre", madre: "madre",
    papa: "padre", papi: "padre", papito: "padre", padre: "padre",
    esposa: "esposa", esposo: "esposo", hija: "hija", mija: "hija", hijo: "hijo", mijo: "hijo",
    hermana: "hermana", hermanita: "hermana", hermano: "hermano", hermanito: "hermano",
    abuela: "abuela", abuelita: "abuela", nana: "abuela", abuelo: "abuelo", abuelito: "abuelo",
    tia: "tia", tita: "tia", titi: "tia", tio: "tio", novia: "novia", novio: "novio",
  },
};

function readRelationship(text: string): RelationshipCode | undefined {
  for (const lang of [ENGLISH, SPANISH]) {
    const alt = Object.keys(lang.words).join("|");
    const afterPhrase = new RegExp(`\\b${lang.phrase}(?:\\W|\\b(?:${lang.possessive})\\b)*\\b(${alt})\\b`);
    const afterPossessive = new RegExp(`\\b${lang.filler} (${alt})\\b`);
    const m = afterPhrase.exec(text) ?? afterPossessive.exec(text);
    if (m) return lang.words[m[1]];
  }
  return undefined;
}

const inRange = (n: number | undefined, max: number) => (n !== undefined && n >= 1 && n <= max ? n : undefined);

export function readCard(message: string): CardReading {
  const text = normalize(message);
  if (MEMORIAL.test(text)) return { result: "memorial" };

  const birthday = BIRTHDAY.test(text);
  const anniversary = ANNIVERSARY.test(text);
  const rawYears = readYears(text);
  if (!birthday && !anniversary && rawYears === undefined) return { result: "none" };

  const relationship = readRelationship(text);
  const extras = (max: number) => {
    const years = inRange(rawYears, max);
    return { ...(relationship ? { relationship } : {}), ...(years !== undefined ? { years } : {}) };
  };

  if (birthday !== anniversary) {
    const kind = birthday ? "birthday" : "anniversary";
    return { result: "date", kind, ...extras(birthday ? 110 : 80) };
  }
  return { result: "review", ...extras(110) };
}
