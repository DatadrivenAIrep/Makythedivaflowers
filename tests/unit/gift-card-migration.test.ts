import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-mig-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function cols(table: string): string[] {
  return (getDb().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (r) => r.name,
  );
}

describe("migration 009_gift_cards", () => {
  it("creates gift_cards with the expected columns", () => {
    const c = cols("gift_cards");
    for (const name of [
      "id", "code", "initial_cents", "balance_cents", "status",
      "recipient_email", "recipient_name", "from_label", "personal_message",
      "reason", "issued_by", "expires_at", "created_at", "updated_at",
    ]) {
      expect(c).toContain(name);
    }
  });

  it("creates gift_card_redemptions with the expected columns", () => {
    const c = cols("gift_card_redemptions");
    for (const name of ["id", "gift_card_id", "order_id", "amount_cents", "type", "created_at"]) {
      expect(c).toContain(name);
    }
  });

  it("adds gift_card columns to orders", () => {
    const c = cols("orders");
    expect(c).toContain("gift_card_id");
    expect(c).toContain("gift_card_cents");
  });
});
