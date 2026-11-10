import { describe, it, expect } from "vitest";
import { renderSaleReminder, safePersonName } from "@/lib/date-sale-message";
import { smsSegments } from "@/lib/sms-segments";
import type { DatePreferences } from "@/lib/date-preferences-storage";

const PREFS: DatePreferences = { flowers: ["hydrangeas"], colors: ["lavender"], avoid: ["strong_scent"] };
const base = {
  customerName: "Andrea Gómez",
  kind: "birthday" as const,
  label: "Laura",
  locale: "es" as const,
  prefs: PREFS,
  rewardPercent: 15 as number | null,
};

describe("safePersonName", () => {
  it("acepta letras y espacios, recortado", () => {
    expect(safePersonName("  Mamá Rosa ")).toBe("Mamá Rosa");
  });
  it("rechaza emoji, enlaces, números, vacío y largo", () => {
    expect(safePersonName("Laura 🎂")).toBeNull();
    expect(safePersonName("www.x.com")).toBeNull();
    expect(safePersonName("Ana2")).toBeNull();
    expect(safePersonName("   ")).toBeNull();
    expect(safePersonName(undefined)).toBeNull();
    expect(safePersonName("a".repeat(41))).toBeNull();
  });
});

describe("renderSaleReminder", () => {
  it("arma el texto completo en español", () => {
    expect(renderSaleReminder(base)).toBe(
      "Diva Flowers: Andrea, en 3 días es el cumpleaños de Laura. Le preparamos hortensias en tonos lavanda, sus favoritas. Tienes 15% en tu tarjeta. Pídelo: https://makythedivaflowers.com/es/ocasiones/birthday Responde STOP para cancelar.",
    );
  });

  it("sin gustos pregunta", () => {
    const body = renderSaleReminder({ ...base, prefs: null });
    expect(body).toContain("¿Te lo preparamos?");
    expect(body).not.toContain("sus favoritas");
    const empty = renderSaleReminder({ ...base, prefs: { flowers: [], colors: [], avoid: [] } });
    expect(empty).toContain("¿Te lo preparamos?");
  });

  it("sin premio omite la frase", () => {
    expect(renderSaleReminder({ ...base, rewardPercent: null })).not.toContain("%");
  });

  it("nunca menciona evitar", () => {
    const body = renderSaleReminder({ ...base, prefs: { flowers: [], colors: [], avoid: ["lilies"] } });
    expect(body.toLowerCase()).not.toContain("lirios");
    expect(body.toLowerCase()).not.toContain("lilies");
  });

  it("nombre de persona con emoji o enlace se omite", () => {
    expect(renderSaleReminder({ ...base, label: "Laura 🎂" })).toContain("un cumpleaños que guardaste");
    expect(renderSaleReminder({ ...base, label: "www.x.com" })).toContain("un cumpleaños que guardaste");
  });

  it("nombre del cliente inseguro o ausente se omite", () => {
    expect(renderSaleReminder({ ...base, customerName: "" })).toMatch(/^Diva Flowers: en 3 días/);
    expect(renderSaleReminder({ ...base, customerName: "www.x.com" })).toMatch(/^Diva Flowers: en 3 días/);
    expect(renderSaleReminder({ ...base, customerName: "Ana🎂 Pérez" })).toMatch(/^Diva Flowers: en 3 días/);
  });

  it("aniversario en inglés", () => {
    const body = renderSaleReminder({ ...base, kind: "anniversary", locale: "en", label: "Sam" });
    expect(body).toBe(
      "Diva Flowers: Andrea, your anniversary with Sam is in 3 days. We can make lavender hydrangeas, their favorites. You have 15% off on your card. Order: https://makythedivaflowers.com/en/ocasiones/anniversary Reply STOP to opt out.",
    );
    const noName = renderSaleReminder({ ...base, kind: "anniversary", locale: "en", label: undefined, customerName: "", prefs: null, rewardPercent: null });
    expect(noName).toBe(
      "Diva Flowers: Your anniversary is in 3 days. Want us to make something? Order: https://makythedivaflowers.com/en/ocasiones/anniversary Reply STOP to opt out.",
    );
  });

  it("cumpleaños sin persona en inglés y aniversario sin persona en español", () => {
    expect(renderSaleReminder({ ...base, locale: "en", label: undefined })).toContain("a birthday you saved is in 3 days.");
    expect(renderSaleReminder({ ...base, kind: "anniversary", label: undefined })).toContain("en 3 días es tu aniversario.");
  });

  it("cabe en 4 segmentos con nombres normales en es y en", () => {
    expect(smsSegments(renderSaleReminder(base))).toBeLessThanOrEqual(4);
    expect(smsSegments(renderSaleReminder({ ...base, locale: "en" }))).toBeLessThanOrEqual(4);
  });

  it("si pasa de 4, quita los gustos y sigue enviando", () => {
    const long = {
      ...base,
      customerName: "Á".repeat(40),
      label: "É".repeat(40),
      prefs: { flowers: ["hydrangeas"], colors: ["lavender"], avoid: [] } as DatePreferences,
    };
    const body = renderSaleReminder(long);
    expect(body).not.toContain("sus favoritas");
    expect(body).toContain("¿Te lo preparamos?");
    expect(body).toContain("Responde STOP");
  });

  it("no lanza con un código de gusto desconocido", () => {
    const bad = { flowers: ["nope"], colors: ["nada"], avoid: [] } as unknown as DatePreferences;
    expect(() => renderSaleReminder({ ...base, prefs: bad })).not.toThrow();
    expect(renderSaleReminder({ ...base, prefs: bad })).toContain("¿Te lo preparamos?");
  });

  it("el enlace usa NEXT_PUBLIC_SITE_URL sin barra final", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://ejemplo.test/";
    try {
      expect(renderSaleReminder(base)).toContain("https://ejemplo.test/es/ocasiones/birthday");
    } finally {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });
});
