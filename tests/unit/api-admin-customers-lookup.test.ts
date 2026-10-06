import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/admin/customers/lookup/route";
import { upsertOnOrder } from "@/lib/customer-storage";
import { closeDb } from "@/lib/db";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-lookup-" + process.pid + ".json");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function get(phone: string): Request {
  return new Request(`http://localhost/api/admin/customers/lookup?phone=${encodeURIComponent(phone)}`);
}

describe("GET /api/admin/customers/lookup", () => {
  it("returns found: false when no customer matches", async () => {
    const res = await GET(get("5165550100"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ found: false, recipients: [], asRecipient: null });
  });

  it("returns the customer when phone matches", async () => {
    upsertOnOrder({ name: "Maria", phone: "5165550100", orderAt: "2026-05-16T00:00:00Z" });
    const res = await GET(get("(516) 555-0100"));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.customer.name).toBe("Maria");
  });

  it("returns 400 on missing phone param", async () => {
    const res = await GET(new Request("http://localhost/api/admin/customers/lookup"));
    expect(res.status).toBe(400);
  });

  it("returns who the caller sends to and what they received themselves", async () => {
    const base: Omit<Order, "id" | "fulfillment" | "contact"> = {
      source: "phone", locale: "es",
      lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
      totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
      status: "delivered", paymentStatus: "paid",
      createdAt: "2026-05-16T12:00:00.000Z", updatedAt: "2026-05-16T12:00:00.000Z",
    };
    await saveOrder({
      ...base, id: "o_sent",
      fulfillment: { method: "pickup", recipient: { name: "Mamá", phone: "5165559999" }, window: { date: "2026-05-16", slot: "midday" } },
      contact: { name: "Maria", phone: "5165550100" },
    });
    await saveOrder({
      ...base, id: "o_received",
      fulfillment: { method: "pickup", recipient: { name: "Maria", phone: "5165550100" }, window: { date: "2026-06-01", slot: "midday" } },
      contact: { name: "Luis", phone: "5165550200" },
    });
    const body = await (await GET(get("5165550100"))).json();
    expect(body.found).toBe(false);
    expect(body.recipients.map((r: { name: string }) => r.name)).toEqual(["Mamá"]);
    expect(body.asRecipient).toMatchObject({ orderCount: 1, senders: [{ name: "Luis" }] });
  });
});
