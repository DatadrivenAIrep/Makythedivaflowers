import { describe, it, expect } from "vitest";
import { AVOID, COLORS, FLOWERS, flowersPhrase } from "@/lib/date-preference-options";
import es from "@/messages/es.json";
import en from "@/messages/en.json";

type Msgs = { date_prefs: { flowers: Record<string, string>; colors: Record<string, string>; avoid: Record<string, string> } };

describe("flowersPhrase", () => {
  it("builds the es and en phrases", () => {
    expect(flowersPhrase("hydrangeas", "lavender", "es")).toBe("hortensias en tonos lavanda");
    expect(flowersPhrase("hydrangeas", "lavender", "en")).toBe("lavender hydrangeas");
    expect(flowersPhrase("roses", undefined, "es")).toBe("rosas");
    expect(flowersPhrase("roses", undefined, "en")).toBe("roses");
    expect(flowersPhrase(undefined, "pink", "es")).toBe("flores en tonos rosados");
    expect(flowersPhrase(undefined, "pink", "en")).toBe("pink flowers");
  });
  it("returns null without flower or color", () => {
    expect(flowersPhrase(undefined, undefined, "en")).toBeNull();
    expect(flowersPhrase(undefined, undefined, "es")).toBeNull();
  });
});

describe("option labels", () => {
  for (const [lang, m] of [["es", es], ["en", en]] as const) {
    it(`every code has a ${lang} label`, () => {
      const p = (m as unknown as Msgs).date_prefs;
      for (const f of FLOWERS) expect(p.flowers[f], f).toBeTruthy();
      for (const c of COLORS) expect(p.colors[c], c).toBeTruthy();
      for (const a of AVOID) {
        const label = (FLOWERS as readonly string[]).includes(a) ? p.flowers[a] : p.avoid[a];
        expect(label, a).toBeTruthy();
      }
    });
  }
});
