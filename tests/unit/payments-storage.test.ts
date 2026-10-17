import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { recordPaymentRow, listPaymentsForDay, firstPaymentDay, toLogMethod } from "@/lib/payments-storage";
import { withTransaction } from "@/lib/db-tx";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("payments storage", () => {
  it("records a row with its shop-local day", () => {
    // 2026-10-17T03:30Z is 11:30 PM on Oct 16 in New York.
    const r = recordPaymentRow({ kind: "payment", method: "cash", amountCents: 5000, orderId: "o1", source: "mark_paid", actor: "maky", at: "2026-10-17T03:30:00.000Z" });
    expect(r.day).toBe("2026-10-16");
    expect(r.id).toMatch(/^pay_/);
    expect(listPaymentsForDay("2026-10-16").map((p) => p.amountCents)).toEqual([5000]);
    expect(listPaymentsForDay("2026-10-17")).toEqual([]);
    expect(firstPaymentDay()).toBe("2026-10-16");
  });

  it("rolls the row back with the transaction", () => {
    expect(() => withTransaction(() => {
      recordPaymentRow({ kind: "deposit", method: "zelle", amountCents: 100, source: "deposit", actor: "maky" });
      throw new Error("boom");
    })).toThrow("boom");
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM payments").get()).toEqual({ n: 0 });
  });

  it("allows a transaction inside a transaction", () => {
    withTransaction(() => withTransaction(() => {
      recordPaymentRow({ kind: "payment", method: "ach", amountCents: 1, source: "mark_paid", actor: "maky" });
    }));
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM payments").get()).toEqual({ n: 1 });
  });

  it("maps order payment methods to log methods", () => {
    expect(toLogMethod("cash")).toBe("cash");
    expect(toLogMethod("stripe")).toBe("stripe");
    expect(toLogMethod("gift-card")).toBe("gift-card");
    expect(toLogMethod("house-account")).toBe("unknown");
    expect(toLogMethod(undefined)).toBe("unknown");
  });
});
