import { describe, it, expect } from "vitest";
import { generateGiftCardCode, normalizeCode, GIFT_CARD_ALPHABET } from "@/lib/gift-card-code";

describe("generateGiftCardCode", () => {
  it("matches DIVA-XXXX-XXXX with the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGiftCardCode();
      expect(code).toMatch(/^DIVA-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      const body = code.slice(5).replace("-", "");
      for (const ch of body) expect(GIFT_CARD_ALPHABET).toContain(ch);
    }
  });

  it("never uses ambiguous characters 0 O 1 I L", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGiftCardCode();
      expect(code.slice(5)).not.toMatch(/[01OIL]/);
    }
  });
});

describe("normalizeCode", () => {
  it("uppercases, strips spaces, and re-inserts dashes", () => {
    expect(normalizeCode("diva 7k2m 9xq4")).toBe("DIVA-7K2M-9XQ4");
    expect(normalizeCode("DIVA7K2M9XQ4")).toBe("DIVA-7K2M-9XQ4");
    expect(normalizeCode("  diva-7k2m-9xq4  ")).toBe("DIVA-7K2M-9XQ4");
  });

  it("returns the input uppercased/trimmed when it does not look like a gift card code", () => {
    expect(normalizeCode("hello")).toBe("HELLO");
  });
});
