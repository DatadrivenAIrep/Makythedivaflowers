import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { ensureInvoiceCode } from "@/lib/invoice-links";
import { GET } from "@/app/i/[code]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, order_number, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '5165551234', 'in-store', NULL, NULL, '[]', 10000,0,863,10863,
       'pending', 'pending', 1001, '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
const get = (code: string) => GET(new Request(`http://x/i/${code}`), { params: Promise.resolve({ code }) });

describe("GET /i/[code]", () => {
  it("404 for a malformed or unknown code", async () => {
    expect((await get("nope")).status).toBe(404);
    expect((await get("AbCdEfGh")).status).toBe(404);
  });

  it("serves the invoice, no-store and noindex", async () => {
    seed("o1");
    const code = ensureInvoiceCode("o1");
    const res = await get(code);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const html = await res.text();
    expect(html).toContain("INV-1001");
    expect(html).toContain("Factura");
  });

  it("404 when the order behind the code is gone", async () => {
    const code = ensureInvoiceCode("missing");
    expect((await get(code)).status).toBe(404);
  });
});
