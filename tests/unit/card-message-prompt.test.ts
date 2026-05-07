import { describe, it, expect } from "vitest";
import { buildCardMessagePrompt } from "@/lib/card-message-prompt";

const baseInput = {
  productTitle: "Timeless Romance",
  occasion: "anniversary" as const,
  relation: "partner" as const,
  locale: "en" as const,
};

describe("buildCardMessagePrompt", () => {
  it("returns a system and user prompt", () => {
    const r = buildCardMessagePrompt(baseInput);
    expect(typeof r.system).toBe("string");
    expect(typeof r.user).toBe("string");
    expect(r.system.length).toBeGreaterThan(50);
    expect(r.user.length).toBeGreaterThan(10);
  });

  it("system prompt mandates strict JSON output shape", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    expect(system).toMatch(/\{"suggestions":/);
    expect(system.toLowerCase()).toContain("exactly three");
  });

  it("system prompt lists banned words", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    for (const word of ["hermoso", "lindo", "perfecto", "increíble", "único", "especial"]) {
      expect(system).toContain(word);
    }
    for (const word of ["beautiful", "perfect", "amazing", "unique", "special"]) {
      expect(system).toContain(word);
    }
  });

  it("system prompt includes occasion-specific tone hints", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    expect(system.toLowerCase()).toContain("anniversary");
    expect(system.toLowerCase()).toContain("birthday");
    expect(system.toLowerCase()).toContain("sympathy");
    expect(system.toLowerCase()).toContain("mothers-day");
  });

  it("system prompt includes the mothers-day tone line", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    expect(system.toLowerCase()).toMatch(/mothers-day → mother.*gratitude.*unseen labor/i);
  });

  it("system prompt names locale (English/Spanish)", () => {
    expect(buildCardMessagePrompt({ ...baseInput, locale: "en" }).system).toContain("English");
    expect(buildCardMessagePrompt({ ...baseInput, locale: "es" }).system).toContain("Spanish");
  });

  it("user prompt contains all four fields verbatim", () => {
    const { user } = buildCardMessagePrompt(baseInput);
    expect(user).toContain("Timeless Romance");
    expect(user).toContain("anniversary");
    expect(user).toContain("partner");
    expect(user).toContain("en");
  });

  it("appends sympathy clause when occasion is sympathy", () => {
    const { system } = buildCardMessagePrompt({ ...baseInput, occasion: "sympathy", relation: "family" });
    expect(system.toLowerCase()).toContain("quiet presence");
    expect(system.toLowerCase()).toMatch(/no religious|no clich/i);
  });

  it("does not append sympathy clause for non-sympathy occasions", () => {
    const { system } = buildCardMessagePrompt(baseInput);
    expect(system.toLowerCase()).not.toContain("quiet presence");
  });
});
