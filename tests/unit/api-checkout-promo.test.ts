import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, setPromoActive } from "@/lib/promo";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-co-promo-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

async function post(body: unknown) {
  const { POST } = await import("@/app/api/checkout/promo/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** A paid order for this phone, so first-order codes see a returning buyer. */
function seedPaidOrder(phone: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO orders (
         id, source, locale, lines_json, fulfillment_method, recipient_name, recipient_phone,
         contact_phone, subtotal_cents, delivery_cents, tax_cents, total_cents,
         fulfillment_status, payment_status, created_at, updated_at
       ) VALUES (?, 'web', 'en', '[]', 'pickup', 'X', ?, ?, 1000, 0, 0, 1000,
                 'pending', 'paid', ?, ?)`,
    )
    .run("seed_" + phone, phone, phone, now, now);
}

describe("POST /api/checkout/promo", () => {
  it("returns the discount for a valid code", async () => {
    createPromo({ code: "TEN", kind: "percent", value: 10 });
    const res = await post({ code: "ten", subtotalCents: 20000, deliveryCents: 1500 });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.code).toBe("TEN");
    expect(data.discountCents).toBe(2000);
  });

  it("reports why an inactive code was refused", async () => {
    const p = createPromo({ code: "OFF", kind: "percent", value: 10 });
    setPromoActive(p.id, false);
    const data = await (await post({ code: "OFF", subtotalCents: 20000, deliveryCents: 0 })).json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("inactive");
  });

  it("returns the minimum so the buyer is told what to spend", async () => {
    createPromo({ code: "MIN75", kind: "percent", value: 10, minSubtotalCents: 7500 });
    const data = await (await post({ code: "MIN75", subtotalCents: 5000, deliveryCents: 0 })).json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("below_minimum");
    expect(data.minSubtotalCents).toBe(7500);
  });

  it("refuses a first-order code when that phone already has a paid order", async () => {
    createPromo({ code: "WELCOME", kind: "percent", value: 10, firstOrderOnly: true });
    seedPaidOrder("5165550123");
    const data = await (
      await post({ code: "WELCOME", subtotalCents: 20000, deliveryCents: 0, phone: "(516) 555-0123" })
    ).json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("not_first_order");
  });

  it("accepts a first-order code for a phone with no prior order", async () => {
    createPromo({ code: "WELCOME2", kind: "percent", value: 10, firstOrderOnly: true });
    const data = await (
      await post({ code: "WELCOME2", subtotalCents: 20000, deliveryCents: 0, phone: "5169999999" })
    ).json();
    expect(data.valid).toBe(true);
  });

  it("rejects a malformed request", async () => {
    const res = await post({ code: "" });
    expect(res.status).toBe(400);
  });
});
