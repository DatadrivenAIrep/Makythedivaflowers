// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  enableForOrder, setTargetUrl, getByOrder, getByCode, digitalCardView,
} from "@/lib/digital-cards";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}

describe("enableForOrder", () => {
  it("creates a card with a code and no url", () => {
    seed("o1");
    const card = enableForOrder("o1", () => "Ab3dE5fG")!;
    expect(card).toMatchObject({
      orderId: "o1", code: "Ab3dE5fG", targetUrl: null,
      shortUrl: "https://makythedivaflowers.com/c/Ab3dE5fG",
    });
    expect(getByCode("Ab3dE5fG")?.orderId).toBe("o1");
  });

  it("is idempotent", () => {
    seed("o1");
    const first = enableForOrder("o1", () => "Ab3dE5fG")!;
    const second = enableForOrder("o1", () => "Zz9yX8wV")!;
    expect(second.code).toBe(first.code);
  });

  it("returns null for a missing order", () => {
    expect(enableForOrder("nope")).toBeNull();
  });

  it("retries on a code collision", () => {
    seed("o1"); seed("o2");
    enableForOrder("o1", () => "AAAAAAAA");
    const codes = ["AAAAAAAA", "BBBBBBBB"];
    const card = enableForOrder("o2", () => codes.shift()!)!;
    expect(card.code).toBe("BBBBBBBB");
  });

  it("gives up after 5 collisions", () => {
    seed("o1"); seed("o2");
    enableForOrder("o1", () => "AAAAAAAA");
    expect(() => enableForOrder("o2", () => "AAAAAAAA")).toThrow(/digital card code/);
  });

  it("returns the row inserted concurrently by another process instead of throwing", () => {
    seed("o1");
    // Simulate a second process winning a check-then-insert race: a row for
    // this order already exists by the time our own INSERT OR IGNORE runs.
    const now = new Date().toISOString();
    getDb().prepare(
      "INSERT INTO digital_cards (order_id, code, target_url, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)",
    ).run("o1", "Zz9yX8wV", now, now);
    const card = enableForOrder("o1", () => "Ab3dE5fG")!;
    expect(card.code).toBe("Zz9yX8wV");
  });
});

describe("setTargetUrl", () => {
  it("stores and clears the url", () => {
    seed("o1");
    enableForOrder("o1", () => "Ab3dE5fG");
    const url = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";
    expect(setTargetUrl("o1", url)?.targetUrl).toBe(url);
    expect(getByOrder("o1")?.targetUrl).toBe(url);
    expect(setTargetUrl("o1", null)?.targetUrl).toBeNull();
  });

  it("returns null when the card was never enabled", () => {
    seed("o1");
    expect(setTargetUrl("o1", "https://tarjetas.makythedivaflowers.com/i/a")).toBeNull();
  });
});

it("digitalCardView keeps only what the UI needs", () => {
  seed("o1");
  const card = enableForOrder("o1", () => "Ab3dE5fG")!;
  expect(digitalCardView(card)).toEqual({
    code: "Ab3dE5fG", shortUrl: "https://makythedivaflowers.com/c/Ab3dE5fG", targetUrl: null,
  });
});
