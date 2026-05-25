import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listOrders, type ListOrdersFilters } from "@/lib/order-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-orders-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, opts: Partial<{
  source: string; paymentStatus: string; fulfillmentStatus: string;
  fulfillmentMethod: string; windowDate: string | null; createdAt: string;
  recipientName: string; recipientPhone: string; contactEmail: string;
  cardMessage: string;
}> = {}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_email,
       contact_phone, fulfillment_method, window_date, card_message, lines_json,
       subtotal_cents, delivery_cents, tax_cents, total_cents,
       fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', ?, ?, ?, ?, '5165550100', ?, ?, ?, '[]', 0, 0, 0, 0, ?, ?, ?, ?)`,
  ).run(
    id, opts.source ?? "web", opts.recipientName ?? "Test",
    opts.recipientPhone ?? "5165550100", opts.contactEmail ?? null,
    opts.fulfillmentMethod ?? "delivery", opts.windowDate ?? "2026-05-26",
    opts.cardMessage ?? null, opts.fulfillmentStatus ?? "pending",
    opts.paymentStatus ?? "pending", opts.createdAt ?? "2026-05-25T10:00:00Z",
    opts.createdAt ?? "2026-05-25T10:00:00Z",
  );
}

describe("listOrders", () => {
  it("returns orders sorted by created_at DESC", async () => {
    seed("a", { createdAt: "2026-05-25T08:00:00Z" });
    seed("b", { createdAt: "2026-05-25T10:00:00Z" });
    seed("c", { createdAt: "2026-05-25T09:00:00Z" });
    const r = await listOrders({});
    expect(r.orders.map(o => o.id)).toEqual(["b", "c", "a"]);
  });

  it("filters by paymentStatus", async () => {
    seed("a", { paymentStatus: "paid" });
    seed("b", { paymentStatus: "pending" });
    const r = await listOrders({ paymentStatus: ["paid"] });
    expect(r.orders.map(o => o.id)).toEqual(["a"]);
  });

  it("filters by source", async () => {
    seed("a", { source: "web" });
    seed("b", { source: "walk-in" });
    seed("c", { source: "phone" });
    const r = await listOrders({ source: ["walk-in", "phone"] });
    expect(r.orders.map(o => o.id).sort()).toEqual(["b", "c"]);
  });

  it("filters by date range", async () => {
    seed("a", { createdAt: "2026-05-20T00:00:00Z" });
    seed("b", { createdAt: "2026-05-25T00:00:00Z" });
    seed("c", { createdAt: "2026-05-30T00:00:00Z" });
    const r = await listOrders({ from: "2026-05-22T00:00:00Z", to: "2026-05-28T00:00:00Z" });
    expect(r.orders.map(o => o.id)).toEqual(["b"]);
  });

  it("free-text search hits recipient name, phone, id, card message", async () => {
    seed("ord_xyz", { recipientName: "Maria Lopez", cardMessage: "Feliz cumple" });
    seed("ord_abc", { recipientName: "John", cardMessage: null as unknown as string });
    expect((await listOrders({ q: "Lopez" })).orders.map(o => o.id)).toEqual(["ord_xyz"]);
    expect((await listOrders({ q: "cumple" })).orders.map(o => o.id)).toEqual(["ord_xyz"]);
    expect((await listOrders({ q: "ord_abc" })).orders.map(o => o.id)).toEqual(["ord_abc"]);
  });

  it("paginates with cursor", async () => {
    for (let i = 0; i < 5; i++) {
      seed(`o${i}`, { createdAt: `2026-05-25T1${i}:00:00Z` });
    }
    const first = await listOrders({ limit: 2 });
    expect(first.orders.map(o => o.id)).toEqual(["o4", "o3"]);
    expect(first.nextCursor).toBeTruthy();
    const second = await listOrders({ limit: 2, cursor: first.nextCursor ?? undefined });
    expect(second.orders.map(o => o.id)).toEqual(["o2", "o1"]);
  });

  it("returns approxTotal independent of pagination", async () => {
    for (let i = 0; i < 5; i++) seed(`o${i}`);
    const r = await listOrders({ limit: 2 });
    expect(r.approxTotal).toBe(5);
  });
});
