import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, validatePromo, getPromoByCode } from "@/lib/promo";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const order = { subtotalCents: 20000, deliveryCents: 1500 };

/**
 * A code sent to one person by text must not work for everyone who sees it.
 * Screenshots get forwarded; a welcome offer or a loyalty reward that any
 * stranger can redeem is a discount with no floor.
 */
describe("promo codes assigned to a phone", () => {
  it("works for the phone it was sent to", () => {
    createPromo({ code: "MINE", kind: "fixed", value: 1500, assignedPhone: "5165550100" });
    expect(validatePromo("MINE", { ...order, buyerPhone: "5165550100" }).ok).toBe(true);
  });

  it("matches that phone however it is typed", () => {
    createPromo({ code: "MINE2", kind: "fixed", value: 1500, assignedPhone: "5165550100" });
    expect(validatePromo("MINE2", { ...order, buyerPhone: "(516) 555-0100" }).ok).toBe(true);
  });

  it("refuses a different phone", () => {
    createPromo({ code: "MINE3", kind: "fixed", value: 1500, assignedPhone: "5165550100" });
    expect(validatePromo("MINE3", { ...order, buyerPhone: "5169999999" })).toEqual({
      ok: false,
      reason: "not_yours",
    });
  });

  it("refuses when no phone is offered at all", () => {
    createPromo({ code: "MINE4", kind: "fixed", value: 1500, assignedPhone: "5165550100" });
    expect(validatePromo("MINE4", order)).toEqual({ ok: false, reason: "not_yours" });
  });

  it("leaves an unassigned code open to anyone, as before", () => {
    createPromo({ code: "OPEN", kind: "percent", value: 10 });
    expect(validatePromo("OPEN", { ...order, buyerPhone: "5169999999" }).ok).toBe(true);
    expect(validatePromo("OPEN", order).ok).toBe(true);
  });
});

describe("promo codes that credit a referrer", () => {
  it("remembers who to credit", () => {
    createPromo({
      code: "REF1",
      kind: "fixed",
      value: 1500,
      referrerCustomerId: "cus_referrer",
    });
    expect(getPromoByCode("REF1")?.referrerCustomerId).toBe("cus_referrer");
  });

  it("leaves it unset on an ordinary code", () => {
    createPromo({ code: "PLAIN", kind: "percent", value: 10 });
    expect(getPromoByCode("PLAIN")?.referrerCustomerId).toBeUndefined();
  });
});
