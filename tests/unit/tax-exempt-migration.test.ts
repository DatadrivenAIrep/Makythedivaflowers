import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, getOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-te-${Math.random().toString(36).slice(2)}.json`);
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function cols(table: string): Record<string, { dflt_value: string | null }> {
  const rows = getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; dflt_value: string | null }>;
  return Object.fromEntries(rows.map((r) => [r.name, r]));
}

function order(id: string, over: Partial<Order> = {}): Order {
  return {
    id, source: "phone", locale: "es",
    lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
    fulfillment: { method: "pickup", recipient: { name: "Ana", phone: "5165550100" }, window: { date: "2026-10-13", slot: "midday" } },
    contact: { phone: "5165550100" },
    totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
    status: "pending", paymentStatus: "pending",
    createdAt: "2026-10-12T12:00:00Z", updatedAt: "2026-10-12T12:00:00Z",
    ...over,
  };
}

describe("037_tax_exempt migration", () => {
  it("adds the exemption columns with exempt defaulting to 0", () => {
    for (const t of ["customers", "house_accounts"]) {
      const c = cols(t);
      expect(c.tax_exempt.dflt_value).toBe("0");
      expect(c.tax_exempt_cert).toBeDefined();
      expect(c.tax_exempt_expires).toBeDefined();
    }
    const o = cols("orders");
    expect(o.tax_exempt.dflt_value).toBe("0");
    expect(o.tax_exempt_cert).toBeDefined();
  });

  it("round-trips the order snapshot", async () => {
    await saveOrder(order("te1", { taxExempt: { cert: "ST-119-42" } }));
    await saveOrder(order("te2"));
    expect((await getOrder("te1"))?.taxExempt).toEqual({ cert: "ST-119-42" });
    expect((await getOrder("te2"))?.taxExempt).toBeUndefined();
    const raw = getDb().prepare("SELECT tax_exempt, tax_exempt_cert FROM orders WHERE id = 'te1'").get();
    expect(raw).toEqual({ tax_exempt: 1, tax_exempt_cert: "ST-119-42" });
  });
});
