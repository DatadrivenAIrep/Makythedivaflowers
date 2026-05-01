import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "object" && v !== null ? flattenKeys(v as Record<string, unknown>, key) : [key];
  });
}

describe("i18n key parity", () => {
  it("en.json and es.json have identical keys", () => {
    const enKeys = new Set(flattenKeys(en));
    const esKeys = new Set(flattenKeys(es));
    const missingInEs = [...enKeys].filter(k => !esKeys.has(k));
    const missingInEn = [...esKeys].filter(k => !enKeys.has(k));
    expect(missingInEs, "Keys in en.json but not es.json").toEqual([]);
    expect(missingInEn, "Keys in es.json but not en.json").toEqual([]);
  });
});
