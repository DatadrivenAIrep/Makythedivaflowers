// @vitest-environment node
import fs from "node:fs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder } from "@/lib/order-storage";
import type { Order } from "@/types/order";
import type { Product } from "@/types/product";

const requireAdminMock = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdminMock(...a) }));
vi.mock("@/lib/product-prices", () => ({
  getPricedProducts: () => [
    { id: "p-normal", category: "arrangements", occasions: ["birthday"], variants: [] } as unknown as Product,
  ],
}));

import { GET, POST } from "@/app/api/admin/occasions/card-dates/route";
import { POST as REVIEW } from "@/app/api/admin/occasions/card-dates/review/route";

// Invented people and messages only.
const STORAGE = `/tmp/diva-test-api-card-dates-${process.pid}.json`;

let seq = 0;
async function seedOrder(card: string, name = "Rosa Pérez", phone = "5165550902") {
  seq += 1;
  const createdAt = new Date(Date.UTC(2026, 2, 20, 12, seq)).toISOString();
  const order: Order = {
    id: `o_api_${seq}`,
    source: "phone",
    locale: "en",
    customerId: "c1",
    lines: [{ kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 }],
    fulfillment: {
      method: "delivery",
      recipient: { name, phone },
      address: { street1: "1 Sample St", city: "Testville", state: "NY", zip: "11550", country: "US" },
      window: { date: "2026-03-21", slot: "morning" },
      cardMessage: card,
    },
    contact: { name: "Ana", phone: "5165550100" },
    totals: { subtotalCents: 0, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 0 },
    status: "pending",
    paymentStatus: "pending",
    createdAt,
    updatedAt: createdAt,
  };
  await saveOrder(order);
  return order;
}

const req = (body?: unknown) =>
  new Request("http://x", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  seq = 0;
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", STORAGE);
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
       VALUES ('c1', 'Ana', '5165550100', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    )
    .run();
  requireAdminMock.mockReturnValue(true);
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  requireAdminMock.mockReset();
  fs.rmSync(STORAGE, { force: true });
});

describe("auth", () => {
  it("answers 401 without an admin session", async () => {
    requireAdminMock.mockReturnValue(false);
    expect((await GET(new Request("http://x"))).status).toBe(401);
    expect((await POST(req())).status).toBe(401);
    expect((await REVIEW(req({ orderId: "x", action: "dismiss" }))).status).toBe(401);
  });
});

describe("GET /api/admin/occasions/card-dates", () => {
  it("returns the preview and the review list, uncached", async () => {
    await seedOrder("Happy birthday Mom");
    await seedOrder("Happy 25th!");
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.preview).toEqual({ pendingOrders: 2, wouldSave: 1, wouldReview: 1, unlinkedOrders: 0 });
    expect(body.reviews).toEqual([]);
  });
});

describe("POST /api/admin/occasions/card-dates", () => {
  it("runs the scan; the second run finds nothing", async () => {
    await seedOrder("Happy birthday Mom");
    await seedOrder("Happy 25th!");
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report).toMatchObject({ scanned: 2, saved: 1, review: 1, failed: 0 });
    expect(body.preview.pendingOrders).toBe(0);
    expect(body.reviews).toHaveLength(1);

    const again = await (await POST(req())).json();
    expect(again.report.scanned).toBe(0);
  });
});

describe("POST /api/admin/occasions/card-dates/review", () => {
  it("dismiss removes the order from the review list", async () => {
    const o = await seedOrder("Happy 25th!");
    await POST(req());
    const res = await REVIEW(req({ orderId: o.id, action: "dismiss" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBe("dismissed");
    expect(body.reviews).toEqual([]);
  });

  it("answers 400 for a bad body and 404 for an unknown order", async () => {
    expect((await REVIEW(req({ orderId: "", action: "dismiss" }))).status).toBe(400);
    expect((await REVIEW(req({ orderId: "x", action: "nope" }))).status).toBe(400);
    expect((await REVIEW(req({ orderId: "x", action: "birthday", name: "a".repeat(41) }))).status).toBe(400);
    expect((await REVIEW(new Request("http://x", { method: "POST", body: "{nope" }))).status).toBe(400);
    expect((await REVIEW(req({ orderId: "nope", action: "dismiss" }))).status).toBe(404);
  });

  it("still answers 200 with the result when re-listing fails", async () => {
    const o = await seedOrder("Happy 25th!");
    await POST(req());
    const scan = await import("@/lib/card-dates-scan");
    vi.spyOn(scan, "listCardReviews").mockImplementation(() => {
      throw new Error("boom");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await REVIEW(req({ orderId: o.id, action: "dismiss" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "dismissed", reviews: null });
    expect(String(err.mock.calls[0][0])).not.toContain("boom");
  });

  it("answers 400 when a name is required", async () => {
    // Recipient is the buyer himself: staff must say who it is for.
    const o = await seedOrder("Happy 25th!", "Ana", "5165550100");
    await POST(req());
    const res = await REVIEW(req({ orderId: o.id, action: "birthday" }));
    expect(res.status).toBe(400);
    expect((await res.json()).result).toBe("name_required");
  });

  it("logs no card text on an unexpected failure", async () => {
    const o = await seedOrder("Happy 25th!");
    await POST(req());
    closeDb();
    vi.stubEnv("SQLITE_FILE", "/nonexistent-dir/x.sqlite");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await REVIEW(req({ orderId: o.id, action: "dismiss" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "failed" });
    expect(String(err.mock.calls[0][0])).toContain("card_dates_route_failed");
  });
});
