// tests/unit/conversion/referral-code.test.ts
import { describe, it, expect } from "vitest";
import { deriveReferralCode } from "@/lib/conversion/referral-code";

describe("deriveReferralCode", () => {
  it("uses last 6 alphanumeric chars uppercased with DIVA- prefix", () => {
    expect(deriveReferralCode("ord_a4f2c9")).toBe("DIVA-A4F2C9");
  });

  it("strips non-alphanumeric characters before slicing", () => {
    expect(deriveReferralCode("ord-2026-05-02-abc123")).toBe("DIVA-ABC123");
  });

  it("pads with X when input has fewer than 6 alphanumeric chars", () => {
    expect(deriveReferralCode("ab")).toBe("DIVA-XXXXAB");
  });

  it("is deterministic for the same input", () => {
    expect(deriveReferralCode("ord_xyz789")).toBe(deriveReferralCode("ord_xyz789"));
  });
});
