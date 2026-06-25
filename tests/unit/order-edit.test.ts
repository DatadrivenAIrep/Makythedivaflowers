import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder } from "@/lib/order-storage";
import { listOrderHistory } from "@/lib/order-history";
import { editOrder } from "@/lib/order-edit";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-${Math.random().toString(36).slice(2)}.json`);
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function baseOrder(id: string, over: Partial<Order> = {}): Order {
  return {
    id, source: "walk-in", locale: "es",
    lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
    fulfillment: { method: "delivery", recipient: { name: "Ana", phone: "555" },
      address: { street1: "1 Main", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2026-07-01", slot: "midday" } },
    contact: { phone: "555" },
    totals: { subtotalCents: 5000, deliveryCents: 1000, taxCents: 518, totalCents: 6518 },
    status: "pending", paymentStatus: "pending",
    createdAt: "2026-06-01T00:00:00Z", updatedAt: "2026-06-01T00:00:00Z",
    ...over,
  };
}

describe("editOrder", () => {
  it("updates a contact field and records a diff in history", async () => {
    await saveOrder(baseOrder("e1"));
    const { order, change } = await editOrder("e1", { contact: { phone: "999" } }, "maky");
    expect(order.contact.phone).toBe("999");
    expect(change).not.toBeNull();
    const hist = await listOrderHistory("e1");
    expect(hist).toHaveLength(1);
    expect(hist[0].kind).toBe("edit");
    const diff = hist[0].changes?.find((c) => c.field === "contact.phone");
    expect(diff?.before).toBe("555");
    expect(diff?.after).toBe("999");
  });

  it("recomputes totals when lines change", async () => {
    await saveOrder(baseOrder("e2"));
    const { order } = await editOrder("e2", {
      lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 2 }],
    }, "maky");
    expect(order.totals.subtotalCents).toBe(10000);
    expect(order.totals.totalCents).toBeGreaterThan(10000); // + delivery + tax
  });

  it("is a no-op when nothing changes (no history row)", async () => {
    await saveOrder(baseOrder("e3"));
    const { change } = await editOrder("e3", { contact: { phone: "555" } }, "maky");
    expect(change).toBeNull();
    expect(await listOrderHistory("e3")).toHaveLength(0);
  });

  it("rejects an edit that leaves zero lines", async () => {
    await saveOrder(baseOrder("e4"));
    await expect(editOrder("e4", { lines: [] }, "maky")).rejects.toThrow(/at least one item/);
  });

  it("throws on unknown order", async () => {
    await expect(editOrder("nope", { contact: { phone: "1" } }, "maky")).rejects.toThrow(/order not found/);
  });
});
