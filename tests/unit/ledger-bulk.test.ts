import { describe, it, expect } from "vitest";
import { planBulk, bulkRequest, ordersCsv } from "@/lib/ledger-bulk";
import type { Order } from "@/types/order";

const order = (over: Partial<Order> = {}): Order => ({
  id: "ord_1",
  orderNumber: 1001,
  source: "phone",
  locale: "es",
  lines: [{ kind: "custom", title: "Corona", priceCents: 10000, qty: 1 }],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 Main St", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-10-16", slot: "midday" },
  },
  contact: { name: "Ana", phone: "5165550100" },
  totals: { subtotalCents: 10000, deliveryCents: 1000, discountCents: 0, tipCents: 0, taxCents: 949, totalCents: 11949 },
  status: "pending",
  paymentStatus: "pending",
  createdAt: "2026-10-15T15:00:00Z",
  updatedAt: "2026-10-15T15:00:00Z",
  ...over,
});

const ids = (os: { id: string }[]) => os.map((o) => o.id);

describe("planBulk: status", () => {
  it("only moves orders forward and skips canceled ones", () => {
    const plan = planBulk(
      [
        order({ id: "a", status: "pending" }),
        order({ id: "b", status: "out-for-delivery" }),
        order({ id: "c", status: "delivered" }),
        order({ id: "d", status: "canceled" }),
      ],
      { kind: "status", status: "out-for-delivery" },
    );
    expect(ids(plan.run)).toEqual(["a"]);
    expect(plan.skipped.map((s) => [s.order.id, s.reason])).toEqual([
      ["b", "already_there"],
      ["c", "already_there"],
      ["d", "canceled"],
    ]);
  });
});

describe("planBulk: paid", () => {
  it("skips paid, refunded, canceled and house-account orders", () => {
    const plan = planBulk(
      [
        order({ id: "a" }),
        order({ id: "deposit", amountPaidCents: 2000 }),
        order({ id: "paid", paymentStatus: "paid" }),
        order({ id: "refunded", paymentStatus: "refunded" }),
        order({ id: "canceled", status: "canceled" }),
        order({ id: "account", houseAccountId: "ha_1" }),
      ],
      { kind: "paid", method: "zelle" },
    );
    expect(ids(plan.run)).toEqual(["a", "deposit"]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["already_paid", "refunded", "canceled", "on_account"]);
  });
});

describe("planBulk: print", () => {
  it("prints everything selected", () => {
    expect(ids(planBulk([order({ id: "a", status: "canceled" }), order({ id: "b" })], { kind: "print" }).run)).toEqual(["a", "b"]);
  });
});

describe("bulkRequest", () => {
  it("calls the same endpoint the order drawer uses", () => {
    expect(bulkRequest({ kind: "status", status: "delivered" }, "o 1")).toEqual({
      url: "/api/admin/orders/o%201/fulfillment",
      init: { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "delivered" }) },
    });
    expect(bulkRequest({ kind: "paid", method: "cash" }, "o1").init.body).toBe(JSON.stringify({ method: "cash" }));
    expect(bulkRequest({ kind: "print" }, "o1")).toEqual({ url: "/api/admin/orders/o1/reprint", init: { method: "POST" } });
  });
});

describe("ordersCsv", () => {
  const nameOf = () => "Mil Latidos (Generoso)";

  it("writes a header and one row per order, money in dollars", () => {
    const csv = ordersCsv([order({ lines: [{ kind: "catalog", productId: "p1", variantId: "lush", addOnIds: [], qty: 2 }] })], "es", nameOf);
    const [header, row] = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(header.split(",")[0]).toBe("Orden");
    expect(header).toContain("Total");
    expect(row).toContain("1001");
    expect(row).toContain("2× Mil Latidos (Generoso)");
    expect(row).toContain("119.49");
    expect(row).toContain("1 Main St");
  });

  it("quotes commas and quotes, and defuses spreadsheet formulas", () => {
    const csv = ordersCsv([order({ contact: { name: '=HYPERLINK("x"), evil', phone: "5165550100" } })], "en", nameOf);
    expect(csv).toContain(`"'=HYPERLINK(""x""), evil"`);
  });

  it("starts with a BOM so Excel reads accents", () => {
    expect(ordersCsv([], "es", nameOf).startsWith("﻿")).toBe(true);
  });
});
