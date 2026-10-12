import { describe, it, expect } from "vitest";
import { byZone, type OrderMetricRow } from "@/lib/metrics";

function row(p: Partial<OrderMetricRow>): OrderMetricRow {
  return {
    totalCents: 10000, amountPaidCents: 10000, paymentStatus: "paid",
    fulfillmentStatus: "delivered", createdAt: "2026-07-01T00:00:00Z",
    linesJson: "[]", addressZip: null, ...p,
  };
}

describe("byZone", () => {
  const resolve = (zip: string) =>
    zip === "11507" ? { id: "albertson", label: "Albertson" }
    : zip === "11576" ? { id: "roslyn", label: "Roslyn" }
    : null;

  it("groups delivery rows by zone, sums collected, unknown zip → unknown bucket, sorted by cents", () => {
    const rows = [
      row({ addressZip: "11507", amountPaidCents: 5000 }),
      row({ addressZip: "11507", amountPaidCents: 3000 }),
      row({ addressZip: "11576", amountPaidCents: 10000 }),
      row({ addressZip: "99999", amountPaidCents: 2000 }), // unknown
      row({ addressZip: null, amountPaidCents: 7000 }), // pickup → excluded
    ];
    expect(byZone(rows, resolve, "Sin zona")).toEqual([
      { zoneId: "roslyn", label: "Roslyn", orderCount: 1, cents: 10000 },
      { zoneId: "albertson", label: "Albertson", orderCount: 2, cents: 8000 },
      { zoneId: "unknown", label: "Sin zona", orderCount: 1, cents: 2000 },
    ]);
  });
});
