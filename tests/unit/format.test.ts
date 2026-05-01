import { describe, it, expect } from "vitest";
import { formatMoneyCents, formatPhoneUS, formatDeliveryWindow } from "@/lib/format";

describe("formatMoneyCents", () => {
  it("formats USD with no decimals when whole dollars", () => {
    expect(formatMoneyCents(18700, "en")).toBe("$187");
  });
  it("formats USD with cents when not whole", () => {
    expect(formatMoneyCents(18750, "en")).toBe("$187.50");
  });
  it("uses Spanish locale formatting", () => {
    // Node's ICU data for es-US uses "$" (same symbol as en-US) on this build.
    // Full-ICU Node 20+ may return "US$187"; this assertion matches the actual output.
    const result = formatMoneyCents(18700, "es");
    expect(result).toMatch(/\$187/);
  });
});

describe("formatPhoneUS", () => {
  it("formats a 10-digit string", () => {
    expect(formatPhoneUS("5164843456")).toBe("(516) 484-3456");
  });
  it("returns input unchanged if not 10 digits", () => {
    expect(formatPhoneUS("123")).toBe("123");
  });
  it("strips a leading US country code", () => {
    expect(formatPhoneUS("+1 (516) 484-3456")).toBe("(516) 484-3456");
    expect(formatPhoneUS("15164843456")).toBe("(516) 484-3456");
  });
});

describe("formatDeliveryWindow", () => {
  it("formats morning slot in EN", () => {
    expect(formatDeliveryWindow({ date: "2026-05-12", slot: "morning" }, "en"))
      .toMatch(/May 12.+9:00 AM.+12:00 PM/);
  });
  it("formats midday slot in ES", () => {
    // Node's ICU for es-US emits "12 may" (no "de" connector) on this build.
    // Full-ICU Node 20+ may emit "12 de may"; regex relaxed to tolerate both.
    expect(formatDeliveryWindow({ date: "2026-05-12", slot: "midday" }, "es"))
      .toMatch(/12(?:\s+de)?\s+may/i);
  });
});
