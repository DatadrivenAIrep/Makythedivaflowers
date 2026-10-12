import { describe, it, expect } from "vitest";
import { buyerKey, firstOrderDays, newVsReturning, topCustomers } from "@/lib/metrics/customers";
import { mo } from "./metrics-fixtures";

describe("buyerKey", () => {
  it("prefers the customer id and falls back to the last 10 phone digits", () => {
    expect(buyerKey(mo({ day: "2026-10-01", customerId: "cus_1" }))).toBe("cus_1");
    expect(buyerKey(mo({ day: "2026-10-01", contactPhone: "+1 (516) 555-0100" }))).toBe("phone:5165550100");
    expect(buyerKey(mo({ day: "2026-10-01", contactPhone: "n/a" }))).toBeNull();
  });
});

describe("newVsReturning", () => {
  const all = [
    mo({ day: "2026-03-01", customerId: "old" }),
    mo({ day: "2026-10-02", customerId: "old", amountPaidCents: 4000 }),
    mo({ day: "2026-10-03", customerId: "new1", amountPaidCents: 6000 }),
    mo({ day: "2026-10-04", customerId: "new1", amountPaidCents: 1000 }),
  ];
  const cur = all.filter((o) => o.day >= "2026-09-13");

  it("calls a buyer new when their first order falls inside the period", () => {
    expect(newVsReturning(cur, firstOrderDays(all), "2026-09-13")).toEqual({
      newBuyers: 1, newCents: 7000, returningBuyers: 1, returningCents: 4000,
    });
  });
  it("for all time, a buyer with one order is new and the rest repeat", () => {
    expect(newVsReturning(all, firstOrderDays(all), null)).toEqual({
      newBuyers: 0, newCents: 0, returningBuyers: 2, returningCents: 21000,
    });
  });
});

describe("topCustomers", () => {
  it("ranks buyers by revenue in the period", () => {
    expect(topCustomers([
      mo({ day: "2026-10-01", customerId: "a", contactName: "Ana", amountPaidCents: 3000 }),
      mo({ day: "2026-10-02", customerId: "a", contactName: "Ana", amountPaidCents: 3000 }),
      mo({ day: "2026-10-03", customerId: "b", contactName: "Beto", amountPaidCents: 5000 }),
    ])).toEqual([
      { key: "a", customerId: "a", name: "Ana", cents: 6000, orders: 2 },
      { key: "b", customerId: "b", name: "Beto", cents: 5000, orders: 1 },
    ]);
  });
});
