import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("015_order_drafts migration", () => {
  it("creates the order_drafts table", () => {
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_drafts'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe("order_drafts");
  });

  it("accepts an insert and read-back", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO order_drafts (id, label, payload_json, item_count, total_cents, taken_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("dr_1", "Lola", "{}", 2, 5000, "maky", "2026-07-31T00:00:00Z", "2026-07-31T00:00:00Z");
    const got = db.prepare("SELECT label, item_count, total_cents FROM order_drafts WHERE id = ?").get("dr_1") as {
      label: string;
      item_count: number;
      total_cents: number;
    };
    expect(got).toEqual({ label: "Lola", item_count: 2, total_cents: 5000 });
  });
});
