import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/admin/recipients/lookup/route";
import { closeDb } from "@/lib/db";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-rlookup-" + process.pid + ".json");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function get(phone?: string): Request {
  const q = phone === undefined ? "" : `?phone=${encodeURIComponent(phone)}`;
  return new Request(`http://localhost/api/admin/recipients/lookup${q}`);
}

describe("GET /api/admin/recipients/lookup", () => {
  it("returns 400 without a phone", async () => {
    expect((await GET(get())).status).toBe(400);
  });

  it("returns found: false for an unknown phone", async () => {
    expect(await (await GET(get("5165551234"))).json()).toEqual({ found: false });
  });

  it("returns the recipient's name, last address and senders", async () => {
    const address = { street1: "1 Rose Ln", city: "Glen Cove", state: "NY", zip: "11542", country: "US" as const };
    await saveOrder({
      id: "o_1", source: "phone", locale: "es",
      lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
      fulfillment: { method: "delivery", recipient: { name: "Carmen", phone: "5165559999" }, address, window: { date: "2026-07-01", slot: "midday" } },
      contact: { name: "Luis", phone: "5165550200" },
      totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
      status: "delivered", paymentStatus: "paid",
      createdAt: "2026-07-01T12:00:00.000Z", updatedAt: "2026-07-01T12:00:00.000Z",
    } as Order);
    const body = await (await GET(get("(516) 555-9999"))).json();
    expect(body.found).toBe(true);
    expect(body.recipient).toMatchObject({ name: "Carmen", lastAddress: address, senders: [{ name: "Luis", orderCount: 1 }] });
  });
});
