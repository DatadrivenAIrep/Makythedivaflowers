import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_test",
          url: "https://buy.stripe.com/test",
          expires_at: 9999999999,
        }),
      },
    },
  },
}));

import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-api-list-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, source = "web", paymentStatus = "pending", createdAt = "2026-05-25T10:00:00Z") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', ?, 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', ?, ?, ?)`,
  ).run(id, source, paymentStatus, createdAt, createdAt);
}

describe("GET /api/admin/orders", () => {
  it("returns all orders by default", async () => {
    seed("a"); seed("b"); seed("c");
    const res = await GET(new Request("http://x/api/admin/orders"));
    const body = await res.json();
    expect(body.orders.length).toBe(3);
    expect(body.approxTotal).toBe(3);
  });

  it("applies paymentStatus[] filter", async () => {
    seed("a", "web", "paid");
    seed("b", "web", "pending");
    const res = await GET(new Request("http://x/api/admin/orders?paymentStatus=paid"));
    const body = await res.json();
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["a"]);
  });

  it("applies free-text q", async () => {
    seed("ord_alpha");
    seed("ord_beta");
    const res = await GET(new Request("http://x/api/admin/orders?q=beta"));
    const body = await res.json();
    expect(body.orders.map((o: { id: string }) => o.id)).toEqual(["ord_beta"]);
  });

  it("paginates with limit + cursor", async () => {
    for (let i = 0; i < 5; i++) seed(`o${i}`, "web", "pending", `2026-05-25T1${i}:00:00Z`);
    const r1 = await GET(new Request("http://x/api/admin/orders?limit=2"));
    const b1 = await r1.json();
    expect(b1.orders.length).toBe(2);
    expect(b1.nextCursor).toBeTruthy();
    const r2 = await GET(new Request(`http://x/api/admin/orders?limit=2&cursor=${encodeURIComponent(b1.nextCursor)}`));
    const b2 = await r2.json();
    expect(b2.orders.length).toBe(2);
    expect(b2.orders[0].id).not.toBe(b1.orders[0].id);
  });
});
