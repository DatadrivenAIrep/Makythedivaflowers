import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { appendInternalNote } from "@/lib/order-mutations";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, notes: string | null = null) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, internal_notes, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, 'pending', 'pending', ?, '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, notes);
}

describe("appendInternalNote", () => {
  it("creates first note with author + timestamp prefix", async () => {
    seed("o1");
    const r = await appendInternalNote("o1", "ring twice", "maky");
    expect(r.internalNotes).toMatch(/^\[.+ · maky\] ring twice$/);
  });

  it("appends second note on a new line", async () => {
    seed("o2");
    await appendInternalNote("o2", "first", "maky");
    const r = await appendInternalNote("o2", "second", "maky");
    expect(r.internalNotes?.split("\n").length).toBe(2);
    expect(r.internalNotes?.endsWith("second")).toBe(true);
  });

  it("rejects empty/whitespace text", async () => {
    seed("o3");
    await expect(appendInternalNote("o3", "   ", "maky")).rejects.toThrow();
  });
});
