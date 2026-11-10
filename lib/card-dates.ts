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
  /\bheaven\b|rest in peace|\brip\b|\bdescanse\b|descansa en paz|\ben paz\b|in memory|en memoria|condolen|sympathy|pesame|\b(?:en el|desde el|al|hasta el) cielo\b/;
const BIRTHDAY = /\b(?:birthday|b-?day|cumple(?:anos|s)?)\b/;
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
  connectors: string; // words allowed between the phrase and the relative
  possessive: string; // "my"-like word that anchors a relative anywhere
  words: Record<string, RelationshipCode>;
};

const ENGLISH: Language = {
  phrase: "happy(?: \\d{1,3}(?:st|nd|rd|th))? (?:birthday|bday|b-day|anniversary)",
  connectors: "to|my|our|dear|beautiful",
  possessive: "my",
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
  phrase: "(?:feliz|felices) (?:cumple(?:anos|s)?|aniversario)",
  connectors: "a|para|mi|nuestra|nuestro|querida|querido|hermosa|bella",
  possessive: "mi",
  words: {
    mama: "madre", mami: "madre", mamita: "madre", madre: "madre",
    papa: "padre", papi: "padre", papito: "padre", padre: "padre",
    esposa: "esposa", esposo: "esposo", hija: "hija", mija: "hija", hijo: "hijo", mijo: "hijo",
    hermana: "hermana", hermanita: "hermana", hermano: "hermano", hermanito: "hermano",
    abuela: "abuela", abuelita: "abuela", nana: "abuela", abuelo: "abuelo", abuelito: "abuelo",
    tia: "tia", tita: "tia", titi: "tia", tio: "tio", novia: "novia", novio: "novio",
  },
};

// Spanglish is common: each language also accepts the other's words, except
// that the English "son" never counts after Spanish ("son tus favoritas").
const { son: _son, ...ENGLISH_NO_SON } = ENGLISH.words;
const CONTEXTS = [
  { lang: ENGLISH, words: { ...SPANISH.words, ...ENGLISH.words } },
  { lang: SPANISH, words: { ...ENGLISH_NO_SON, ...SPANISH.words } },
];

// A relative named after "from" / "de parte de" is the sender, not the recipient.
const NOT_SENDER = "(?<!\\bfrom )(?<!\\bde parte de )";
// "mother-in-law" is not "mother".
const NOT_IN_LAW = "(?![- ]in[- ]law)";

function readRelationship(text: string): RelationshipCode | undefined {
  for (const { lang, words } of CONTEXTS) {
    const alt = Object.keys(words).join("|");
    const word = `\\b(${alt})\\b${NOT_IN_LAW}`;
    const afterPhrase = new RegExp(`\\b${lang.phrase}(?:\\W|\\b(?:${lang.connectors})\\b)*${word}`);
    const afterPossessive = new RegExp(`${NOT_SENDER}\\b${lang.possessive} ${word}`);
    const m = afterPhrase.exec(text) ?? afterPossessive.exec(text);
    if (m) return words[m[1]];
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
