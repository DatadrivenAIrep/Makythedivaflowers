import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry, acknowledge } from "@/lib/inquiry-storage-db";
import { getAttention } from "@/lib/attention";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

function seedWebOrder(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'web', 'Maria', '555', '555', 'delivery', '2026-05-26', '[]',
       0,0,0,0, 'pending', 'paid', '2026-05-25T13:00:00Z', '2026-05-25T13:00:00Z')`,
  ).run(id);
}

it("aggregates pending orders + unacked leads + unacked contacts with counts", async () => {
  seedWebOrder("o1"); // qualifies as web_unacknowledged
  createInquiry({ id: "w1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com", contactPhone: "1", sourceChannel: "web" });
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  createInquiry({ id: "w2", type: "wedding", contactName: "Bea", contactEmail: "b@x.com", contactPhone: "1", sourceChannel: "web" });
  acknowledge("w2"); // excluded

  const snap = await getAttention();
  expect(snap.counts).toEqual({ orders: 1, inquiries: 1, contacts: 1, total: 3 });
  expect(snap.items.find((i) => i.id === "o1")?.kind).toBe("order");
  expect(snap.items.find((i) => i.id === "c1")?.label).toBe("Contacto · Luis");
});
