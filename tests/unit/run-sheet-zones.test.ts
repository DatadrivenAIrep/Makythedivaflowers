import { describe, it, expect } from "vitest";
import {
  NO_ZONE_KEY,
  compareRunSheetWindows,
  groupRunSheetByZone,
  resolveRunSheetZone,
} from "@/lib/run-sheet-zones";
import type { DeliverySlot, Order } from "@/types/order";

const totals = { subtotalCents: 5000, deliveryCents: 1000, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 6000 };

function base(id: string): Omit<Order, "fulfillment"> {
  return {
    id, source: "web", locale: "es", lines: [], contact: { phone: "5551234567" }, totals,
    status: "pending", paymentStatus: "paid",
    createdAt: "2026-07-04T00:00:00Z", updatedAt: "2026-07-04T00:00:00Z",
  };
}

function delivery(
  id: string,
  opts: { zip?: string; city?: string; slot?: DeliverySlot; time?: string } = {},
): Order {
  return {
    ...base(id),
    fulfillment: {
      method: "delivery",
      recipient: { name: `R ${id}`, phone: "5551234567" },
      address: { street1: "1 Main St", city: opts.city ?? "Elsewhere", state: "NY", zip: opts.zip ?? "", country: "US" },
      window: { date: "2026-07-04", slot: opts.slot ?? "midday", ...(opts.time ? { time: opts.time } : {}) },
    },
  };
}

function pickup(id: string): Order {
  return {
    ...base(id),
    fulfillment: {
      method: "pickup",
      recipient: { name: `P ${id}`, phone: "5551234567" },
      window: { date: "2026-07-04", slot: "morning" },
    },
  };
}

function inStore(id: string): Order {
  return { ...base(id), fulfillment: { method: "in-store", recipient: { name: `S ${id}`, phone: "5551234567" } } };
}

const ids = (os: Order[]) => os.map((o) => o.id);

describe("resolveRunSheetZone", () => {
  it("matches the zone by ZIP", () => {
    expect(resolveRunSheetZone(delivery("a", { zip: "11576" }))?.id).toBe("roslyn");
  });

  it("uses only the first 5 digits of a ZIP+4", () => {
    expect(resolveRunSheetZone(delivery("a", { zip: "11030-1234" }))?.id).toBe("manhasset");
  });

  it("falls back to the city when the ZIP matches no zone", () => {
    expect(resolveRunSheetZone(delivery("a", { zip: "90210", city: "  great neck " }))?.id).toBe("great-neck");
    expect(resolveRunSheetZone(delivery("b", { zip: "", city: "Roslyn" }))?.id).toBe("roslyn");
  });

  it("prefers the ZIP over a conflicting city", () => {
    expect(resolveRunSheetZone(delivery("a", { zip: "11507", city: "Roslyn" }))?.id).toBe("albertson");
  });

  it("returns null for an unknown ZIP and city", () => {
    expect(resolveRunSheetZone(delivery("a", { zip: "90210", city: "Beverly Hills" }))).toBeNull();
  });

  it("returns null for non-delivery orders", () => {
    expect(resolveRunSheetZone(pickup("p"))).toBeNull();
  });
});

describe("compareRunSheetWindows", () => {
  const w = (slot: DeliverySlot, time?: string) => ({ date: "2026-07-04", slot, ...(time ? { time } : {}) });

  it("orders slots morning → midday → afternoon → evening", () => {
    const sorted = (["evening", "morning", "afternoon", "midday"] as DeliverySlot[])
      .map((s) => w(s))
      .sort(compareRunSheetWindows)
      .map((x) => x.slot);
    expect(sorted).toEqual(["morning", "midday", "afternoon", "evening"]);
  });

  it("uses the exact time when set, against other times and slot starts", () => {
    expect(compareRunSheetWindows(w("morning", "10:30"), w("midday"))).toBeLessThan(0); // 10:30 < 12:00
    expect(compareRunSheetWindows(w("midday", "13:00"), w("midday"))).toBeGreaterThan(0); // 13:00 > 12:00
    expect(compareRunSheetWindows(w("afternoon", "16:15"), w("afternoon", "15:05"))).toBeGreaterThan(0);
  });
});

describe("groupRunSheetByZone", () => {
  it("groups by zone in the deliveryZones order, with Sin zona last", () => {
    const { groups } = groupRunSheetByZone([
      delivery("unknown", { zip: "90210", city: "Nowhere" }),
      delivery("gn", { zip: "11021" }),
      delivery("rs1", { zip: "11576" }),
      delivery("alb", { zip: "11507" }),
      delivery("rs2", { zip: "", city: "Roslyn" }),
      delivery("far", { zip: "11432" }), // Jamaica → catch-all "further"
    ]);
    expect(groups.map((g) => g.key)).toEqual(["albertson", "roslyn", "great-neck", "further", NO_ZONE_KEY]);
    expect(ids(groups.find((g) => g.key === "roslyn")!.orders)).toEqual(["rs1", "rs2"]);
    const none = groups[groups.length - 1];
    expect(none.zone).toBeNull();
    expect(ids(none.orders)).toEqual(["unknown"]);
    expect(groups[0].zone?.label.es).toBe("Albertson");
  });

  it("sorts each group by window: exact time or slot start, stable on ties", () => {
    const { groups } = groupRunSheetByZone([
      delivery("eve", { zip: "11576", slot: "evening" }),
      delivery("t1430", { zip: "11576", slot: "midday", time: "14:30" }),
      delivery("mid1", { zip: "11576", slot: "midday" }),
      delivery("t0930", { zip: "11576", slot: "morning", time: "09:30" }),
      delivery("mid2", { zip: "11577", slot: "midday" }),
      delivery("aft", { zip: "11576", slot: "afternoon" }),
      delivery("mor", { zip: "11576", slot: "morning" }),
    ]);
    expect(groups).toHaveLength(1);
    // 09:00 · 09:30 · 12:00 · 12:00 (input order kept) · 14:30 · 15:00 · 18:00
    expect(ids(groups[0].orders)).toEqual(["mor", "t0930", "mid1", "mid2", "t1430", "aft", "eve"]);
  });

  it("keeps pickup and in-store orders out of the zone groups", () => {
    const { groups, pickups } = groupRunSheetByZone([
      pickup("p1"),
      delivery("d1", { zip: "11507" }),
      inStore("s1"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["albertson"]);
    expect(ids(groups[0].orders)).toEqual(["d1"]);
    expect(ids(pickups)).toEqual(["p1", "s1"]);
  });

  it("returns no groups for an empty day", () => {
    expect(groupRunSheetByZone([])).toEqual({ groups: [], pickups: [] });
  });

  it("does not reorder the caller's array", () => {
    const input = [delivery("b", { zip: "11576", slot: "evening" }), delivery("a", { zip: "11507" })];
    groupRunSheetByZone(input);
    expect(ids(input)).toEqual(["b", "a"]);
  });
});
