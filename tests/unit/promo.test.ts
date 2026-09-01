import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  createPromo,
  getPromoByCode,
  validatePromo,
  discountForPromo,
  redeemPromo,
  listPromos,
  setPromoActive,
} from "@/lib/promo";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const base = { subtotalCents: 20000, deliveryCents: 1500 };

describe("createPromo", () => {
  it("stores the code uppercased and trimmed so entry is forgiving", () => {
    createPromo({ code: "  bienvenida10 ", kind: "percent", value: 10 });
    expect(getPromoByCode("BIENVENIDA10")?.code).toBe("BIENVENIDA10");
    expect(getPromoByCode(" bienvenida10 ")?.code).toBe("BIENVENIDA10");
  });

  it("rejects a duplicate code", () => {
    createPromo({ code: "DUP", kind: "percent", value: 10 });
    expect(() => createPromo({ code: "dup", kind: "percent", value: 20 })).toThrow();
  });

  it("rejects a percent outside 1-100", () => {
    expect(() => createPromo({ code: "P0", kind: "percent", value: 0 })).toThrow();
    expect(() => createPromo({ code: "P101", kind: "percent", value: 101 })).toThrow();
  });

  it("rejects a non-positive fixed amount", () => {
    expect(() => createPromo({ code: "F0", kind: "fixed", value: 0 })).toThrow();
  });
});

describe("discountForPromo", () => {
  it("takes a percentage of the subtotal, never of delivery", () => {
    const promo = createPromo({ code: "TEN", kind: "percent", value: 10 });
    expect(discountForPromo(promo, base)).toBe(2000);
  });

  it("rounds a percentage to the nearest cent", () => {
    const promo = createPromo({ code: "FIFTEEN", kind: "percent", value: 15 });
    expect(discountForPromo(promo, { subtotalCents: 6533, deliveryCents: 0 })).toBe(980);
  });

  it("takes a fixed amount off the subtotal", () => {
    const promo = createPromo({ code: "TENOFF", kind: "fixed", value: 1000 });
    expect(discountForPromo(promo, base)).toBe(1000);
  });

  it("caps a fixed amount at the subtotal so it never eats the delivery fee", () => {
    const promo = createPromo({ code: "BIG", kind: "fixed", value: 50000 });
    expect(discountForPromo(promo, base)).toBe(20000);
  });

  it("free delivery discounts exactly the delivery fee", () => {
    const promo = createPromo({ code: "SHIPFREE", kind: "free_delivery", value: 0 });
    expect(discountForPromo(promo, base)).toBe(1500);
  });

  it("free delivery is worth nothing on a pickup order", () => {
    const promo = createPromo({ code: "SHIPFREE2", kind: "free_delivery", value: 0 });
    expect(discountForPromo(promo, { subtotalCents: 20000, deliveryCents: 0 })).toBe(0);
  });
});

describe("validatePromo", () => {
  it("accepts an active code and reports the discount", () => {
    createPromo({ code: "OK10", kind: "percent", value: 10 });
    const r = validatePromo("ok10", base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.discountCents).toBe(2000);
  });

  it("rejects an unknown code", () => {
    const r = validatePromo("NOPE", base);
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a deactivated code", () => {
    const p = createPromo({ code: "OFF", kind: "percent", value: 10 });
    setPromoActive(p.id, false);
    expect(validatePromo("OFF", base)).toEqual({ ok: false, reason: "inactive" });
  });

  it("rejects a code whose window has not opened", () => {
    const tomorrow = new Date(Date.now() + 86400_000).toISOString();
    createPromo({ code: "SOON", kind: "percent", value: 10, startsAt: tomorrow });
    expect(validatePromo("SOON", base)).toEqual({ ok: false, reason: "not_started" });
  });

  it("rejects an expired code", () => {
    const yesterday = new Date(Date.now() - 86400_000).toISOString();
    createPromo({ code: "OLD", kind: "percent", value: 10, endsAt: yesterday });
    expect(validatePromo("OLD", base)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects an order below the minimum subtotal and says what it is", () => {
    createPromo({ code: "MIN75", kind: "percent", value: 10, minSubtotalCents: 7500 });
    const r = validatePromo("MIN75", { subtotalCents: 5000, deliveryCents: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("below_minimum");
      expect(r.minSubtotalCents).toBe(7500);
    }
  });

  it("accepts an order exactly at the minimum subtotal", () => {
    createPromo({ code: "MIN75B", kind: "percent", value: 10, minSubtotalCents: 7500 });
    expect(validatePromo("MIN75B", { subtotalCents: 7500, deliveryCents: 0 }).ok).toBe(true);
  });

  it("rejects a code that has reached its redemption limit", () => {
    const p = createPromo({ code: "ONCE", kind: "percent", value: 10, maxRedemptions: 1 });
    redeemPromo(p.id, "order-1", 2000);
    expect(validatePromo("ONCE", base)).toEqual({ ok: false, reason: "exhausted" });
  });

  it("still accepts a limited code with redemptions left", () => {
    const p = createPromo({ code: "TWICE", kind: "percent", value: 10, maxRedemptions: 2 });
    redeemPromo(p.id, "order-1", 2000);
    expect(validatePromo("TWICE", base).ok).toBe(true);
  });

  it("rejects a first-order code for a buyer who already ordered", () => {
    createPromo({ code: "WELCOME", kind: "percent", value: 10, firstOrderOnly: true });
    const r = validatePromo("WELCOME", { ...base, buyerHasOrdered: true });
    expect(r).toEqual({ ok: false, reason: "not_first_order" });
  });

  it("accepts a first-order code for a new buyer", () => {
    createPromo({ code: "WELCOME2", kind: "percent", value: 10, firstOrderOnly: true });
    expect(validatePromo("WELCOME2", { ...base, buyerHasOrdered: false }).ok).toBe(true);
  });

  it("rejects a promo that would discount nothing", () => {
    // Free delivery on a pickup order: valid code, but zero value — accepting it
    // would show the buyer a promo line worth $0.
    createPromo({ code: "SHIP", kind: "free_delivery", value: 0 });
    expect(validatePromo("SHIP", { subtotalCents: 20000, deliveryCents: 0 })).toEqual({
      ok: false,
      reason: "no_discount",
    });
  });
});

describe("redeemPromo", () => {
  it("records a redemption and raises the used count", () => {
    const p = createPromo({ code: "R1", kind: "percent", value: 10 });
    redeemPromo(p.id, "order-1", 2000);
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(1);
  });

  it("is idempotent per order so a webhook retry cannot double-count", () => {
    const p = createPromo({ code: "R2", kind: "percent", value: 10 });
    redeemPromo(p.id, "order-1", 2000);
    redeemPromo(p.id, "order-1", 2000);
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(1);
  });

  it("counts two different orders separately", () => {
    const p = createPromo({ code: "R3", kind: "percent", value: 10 });
    redeemPromo(p.id, "order-1", 2000);
    redeemPromo(p.id, "order-2", 1500);
    expect(listPromos().find((x) => x.id === p.id)?.redemptionCount).toBe(2);
  });

  it("refuses to redeem past the limit even if validate was called earlier", () => {
    // Guards the race where two checkouts both validate before either redeems.
    const p = createPromo({ code: "R4", kind: "percent", value: 10, maxRedemptions: 1 });
    redeemPromo(p.id, "order-1", 2000);
    expect(() => redeemPromo(p.id, "order-2", 2000)).toThrow();
  });
});

describe("listPromos", () => {
  it("returns promos with their redemption counts and discounted totals", () => {
    const p = createPromo({ code: "L1", kind: "fixed", value: 1000 });
    redeemPromo(p.id, "order-1", 1000);
    redeemPromo(p.id, "order-2", 1000);
    const row = listPromos().find((x) => x.id === p.id);
    expect(row?.redemptionCount).toBe(2);
    expect(row?.discountedCents).toBe(2000);
  });
});
