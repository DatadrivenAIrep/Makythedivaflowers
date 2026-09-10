import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/stripe-server", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({ id: "cs_test", url: "https://buy.stripe.com/test", expires_at: 9999999999 }),
      },
    },
  },
}));

import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET } from "@/app/api/admin/orders/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-api-hide-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seed(
  id: string,
  opts: { source?: string; paymentStatus?: string; fulfillmentStatus?: string } = {},
) {
  const { source = "web", paymentStatus = "pending", fulfillmentStatus = "pending" } = opts;
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
         fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
         total_cents, fulfillment_status, payment_status, created_at, updated_at)
       VALUES (?, 'es', ?, 'R', '555', '555', 'delivery', '2026-06-01', '[]',
         0,0,0,0, ?, ?, '2026-05-25T10:00:00Z', '2026-05-25T10:00:00Z')`,
    )
    .run(id, source, fulfillmentStatus, paymentStatus);
}

async function list(query = ""): Promise<{ ids: string[]; approxTotal: number; hiddenCount: number }> {
  const res = await GET(new Request(`http://x/api/admin/orders${query}`));
  const body = await res.json();
  return {
    ids: body.orders.map((o: { id: string }) => o.id),
    approxTotal: body.approxTotal,
    hiddenCount: body.hiddenCount,
  };
}

describe("GET /api/admin/orders?hideInactive=1", () => {
  it("still returns everything when the flag is absent", async () => {
    seed("paid", { paymentStatus: "paid" });
    seed("abandoned");
    seed("cancelled", { fulfillmentStatus: "canceled" });
    const { ids } = await list();
    expect(ids.sort()).toEqual(["abandoned", "cancelled", "paid"]);
  });

  it("hides cancelled orders", async () => {
    seed("live", { paymentStatus: "paid" });
    seed("cancelled", { paymentStatus: "paid", fulfillmentStatus: "canceled" });
    const { ids } = await list("?hideInactive=1");
    expect(ids).toEqual(["live"]);
  });

  it("hides web checkouts that were never paid", async () => {
    // A buyer who abandons or fails card entry leaves a pending row behind.
    seed("paid", { paymentStatus: "paid" });
    seed("abandoned1");
    seed("abandoned2");
    const { ids } = await list("?hideInactive=1");
    expect(ids).toEqual(["paid"]);
  });

  it("keeps unpaid intake orders visible — those are real work", async () => {
    // Walk-in/phone orders legitimately sit pending while awaiting a payment
    // link, so they must never be swept up with abandoned web checkouts.
    seed("walkin", { source: "walk-in", paymentStatus: "pending" });
    seed("phone", { source: "phone", paymentStatus: "pending" });
    seed("abandoned", { source: "web", paymentStatus: "pending" });
    const { ids } = await list("?hideInactive=1");
    expect(ids.sort()).toEqual(["phone", "walkin"]);
  });

  it("reports how many rows it hid, so nothing disappears silently", async () => {
    seed("paid", { paymentStatus: "paid" });
    seed("abandoned");
    seed("cancelled", { fulfillmentStatus: "canceled" });
    const { approxTotal, hiddenCount } = await list("?hideInactive=1");
    expect(approxTotal).toBe(1);
    expect(hiddenCount).toBe(2);
  });

  it("reports zero hidden when the flag is absent", async () => {
    seed("abandoned");
    const { hiddenCount } = await list();
    expect(hiddenCount).toBe(0);
  });

  it("shows cancelled orders when they are explicitly filtered for", async () => {
    seed("live", { paymentStatus: "paid" });
    seed("cancelled", { paymentStatus: "paid", fulfillmentStatus: "canceled" });
    const { ids } = await list("?hideInactive=1&fulfillmentStatus=canceled");
    expect(ids).toEqual(["cancelled"]);
  });

  it("shows unpaid web orders when pending is explicitly filtered for", async () => {
    seed("paid", { paymentStatus: "paid" });
    seed("abandoned");
    const { ids } = await list("?hideInactive=1&paymentStatus=pending");
    expect(ids).toEqual(["abandoned"]);
  });
});
