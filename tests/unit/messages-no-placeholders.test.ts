import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

/**
 * The live Terms of Service page shipped with "DRAFT:" on every paragraph, plus
 * sentences addressed to the shop owner ("consult a qualified attorney before
 * publishing") that customers were reading. Nothing caught it because nothing
 * was looking.
 */
const LOCALES = { en, es } as const;

// Markers that mean a string was never finished for a customer to read.
// Matches the "DRAFT:" prefix form specifically — the campaigns admin has a
// legitimate "draft" campaign status, and flagging that word everywhere would
// make this test noise instead of a guard.
const PLACEHOLDER = /(^|\s)(DRAFT|BORRADOR)\s*:|\b(TODO|FIXME|LOREM IPSUM|PLACEHOLDER)\b/;

// Notes written to the site owner, not to the reader.
const INTERNAL_NOTE =
  /(consult|have|ask) an? (qualified |licensed )?attorney|attorney review|reviewed by an attorney|requires legal review|revisi[oó]n legal|revisad[oa] por un abogado|consulta a un abogado/i;

function walk(obj: unknown, path: string[] = []): [string, string][] {
  if (typeof obj === "string") return [[path.join("."), obj]];
  if (obj && typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => walk(v, [...path, k]));
  }
  return [];
}

describe("customer-facing copy", () => {
  for (const [locale, messages] of Object.entries(LOCALES)) {
    const strings = walk(messages);

    it(`${locale}: ships no DRAFT / TODO / placeholder markers`, () => {
      const bad = strings.filter(([, v]) => PLACEHOLDER.test(v)).map(([k]) => k);
      expect(bad, `placeholder text would render to customers at: ${bad.join(", ")}`).toEqual([]);
    });

    it(`${locale}: leaks no notes addressed to the site owner`, () => {
      const bad = strings.filter(([, v]) => INTERNAL_NOTE.test(v)).map(([k]) => k);
      expect(bad, `internal review notes would render to customers at: ${bad.join(", ")}`).toEqual([]);
    });

    it(`${locale}: has no empty strings`, () => {
      const empty = strings.filter(([, v]) => v.trim() === "").map(([k]) => k);
      expect(empty).toEqual([]);
    });
  }

  it("keeps en and es structurally in sync", () => {
    const keys = (m: unknown) => walk(m).map(([k]) => k).sort();
    const enKeys = keys(en);
    const esKeys = keys(es);
    expect(enKeys.filter((k) => !esKeys.includes(k)), "missing from es").toEqual([]);
    expect(esKeys.filter((k) => !enKeys.includes(k)), "missing from en").toEqual([]);
  });
});
