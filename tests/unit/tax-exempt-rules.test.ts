import { describe, it, expect } from "vitest";
import {
  exemptionStatus, isExemptionValid, resolveDefaultExemption, resolveOrderExemption,
  isRequestExempt, normalizeExemptionInput,
} from "@/lib/tax-exempt";
import { taxExemptionInput, taxExemptRequest } from "@/schemas/tax-exempt";
import type { TaxExemption } from "@/types/tax-exempt";

const TODAY = "2026-10-12";
const ex = (cert: string | null, expires: string | null = null, exempt = true): TaxExemption => ({ exempt, cert, expires });

describe("exemptionStatus", () => {
  it("none when missing or not exempt", () => {
    expect(exemptionStatus(null, TODAY)).toBe("none");
    expect(exemptionStatus(ex("123", null, false), TODAY)).toBe("none");
  });
  it("missing_cert when exempt without a certificate", () => {
    expect(exemptionStatus(ex(null), TODAY)).toBe("missing_cert");
    expect(exemptionStatus(ex("   "), TODAY)).toBe("missing_cert");
  });
  it("expired only strictly before today; no expiry never expires", () => {
    expect(exemptionStatus(ex("123", "2026-10-11"), TODAY)).toBe("expired");
    expect(exemptionStatus(ex("123", "2026-10-12"), TODAY)).toBe("active");
    expect(exemptionStatus(ex("123", null), TODAY)).toBe("active");
    expect(isExemptionValid(ex("123"), TODAY)).toBe(true);
    expect(isExemptionValid(ex("123", "2020-01-01"), TODAY)).toBe(false);
  });
});

describe("resolveDefaultExemption", () => {
  it("account beats customer", () => {
    expect(resolveDefaultExemption({ account: ex("ACC"), customer: ex("CUS"), today: TODAY }))
      .toEqual({ cert: "ACC", source: "account" });
  });
  it("falls back to the customer when the account exemption is invalid", () => {
    expect(resolveDefaultExemption({ account: ex("ACC", "2020-01-01"), customer: ex(" CUS "), today: TODAY }))
      .toEqual({ cert: "CUS", source: "customer" });
  });
  it("null when nothing valid", () => {
    expect(resolveDefaultExemption({ account: null, customer: ex(null), today: TODAY })).toBeNull();
  });
});

describe("resolveOrderExemption", () => {
  it("no request → the fallback", () => {
    expect(resolveOrderExemption({ fallback: { cert: "A" } })).toEqual({ ok: true, exemption: { cert: "A" } });
    expect(resolveOrderExemption({ fallback: null })).toEqual({ ok: true, exemption: null });
  });
  it("staff switched it off", () => {
    expect(resolveOrderExemption({ fallback: { cert: "A" }, requested: { taxExempt: false } }))
      .toEqual({ ok: true, exemption: null });
  });
  it("staff switched it on: typed cert wins, else the fallback cert", () => {
    expect(resolveOrderExemption({ fallback: { cert: "A" }, requested: { taxExempt: true, cert: " B " } }))
      .toEqual({ ok: true, exemption: { cert: "B" } });
    expect(resolveOrderExemption({ fallback: { cert: "A" }, requested: { taxExempt: true } }))
      .toEqual({ ok: true, exemption: { cert: "A" } });
  });
  it("on without any cert is an error", () => {
    expect(resolveOrderExemption({ fallback: null, requested: { taxExempt: true, cert: "  " } }))
      .toEqual({ ok: false, error: "tax_exempt_cert_required" });
  });
  it("isRequestExempt mirrors the toggle", () => {
    expect(isRequestExempt({ cert: "A" })).toBe(true);
    expect(isRequestExempt(null)).toBe(false);
    expect(isRequestExempt({ cert: "A" }, { taxExempt: false })).toBe(false);
    expect(isRequestExempt(null, { taxExempt: true, cert: "X" })).toBe(true);
  });
});

describe("normalizeExemptionInput", () => {
  it("trims and nulls empty strings", () => {
    expect(normalizeExemptionInput({ exempt: true, cert: " 12-3 ", expires: "" }))
      .toEqual({ exempt: true, cert: "12-3", expires: null });
    expect(normalizeExemptionInput({ exempt: false, cert: "", expires: null }))
      .toEqual({ exempt: false, cert: null, expires: null });
  });
  it("throws when exempt without a cert", () => {
    expect(() => normalizeExemptionInput({ exempt: true, cert: " " })).toThrow("tax_exempt_cert_required");
  });
});

describe("schemas", () => {
  it("taxExemptionInput requires a cert when exempt and a YYYY-MM-DD expiry", () => {
    expect(taxExemptionInput.safeParse({ exempt: true, cert: "1" }).success).toBe(true);
    expect(taxExemptionInput.safeParse({ exempt: true, cert: "" }).success).toBe(false);
    expect(taxExemptionInput.safeParse({ exempt: false }).success).toBe(true);
    expect(taxExemptionInput.safeParse({ exempt: true, cert: "1", expires: "10/12/2026" }).success).toBe(false);
    expect(taxExemptionInput.safeParse({ exempt: true, cert: "1", expires: "" }).success).toBe(true);
  });
  it("taxExemptRequest", () => {
    expect(taxExemptRequest.safeParse({ taxExempt: true }).success).toBe(true);
    expect(taxExemptRequest.safeParse({ taxExempt: "yes" }).success).toBe(false);
  });
});
