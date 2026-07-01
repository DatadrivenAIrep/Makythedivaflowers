import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
function leafKeys(obj: unknown, prefix = ""): string[] {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}
describe("i18n en/es parity", () => {
  it("en.json and es.json have identical key paths", () => {
    const enKeys = new Set(leafKeys(en)); const esKeys = new Set(leafKeys(es));
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
    expect({ missingInEs, missingInEn }).toEqual({ missingInEs: [], missingInEn: [] });
  });
});
