import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardByCode, displayStatus } from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-store-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("issueGiftCard", () => {
  it("creates an active card with full balance and a 1-year expiry", () => {
    const card = issueGiftCard({
      initialCents: 15000,
      recipientEmail: "maria@example.com",
      recipientName: "María",
      fromLabel: "Maky · Diva Flowers",
      personalMessage: "¡Gracias!",
      reason: "loyalty",
      issuedBy: "maky",
    });
    expect(card.code).toMatch(/^DIVA-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(card.initialCents).toBe(15000);
    expect(card.balanceCents).toBe(15000);
    expect(card.status).toBe("active");
    expect(card.recipientEmail).toBe("maria@example.com");
    expect(card.expiresAt).toBeTruthy();
    const days = (Date.parse(card.expiresAt!) - Date.parse(card.createdAt)) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(372);
  });

  it("is retrievable by code, normalizing messy input", () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const lower = card.code.toLowerCase().replace(/-/g, " ");
    const found = getGiftCardByCode(lower);
    expect(found?.id).toBe(card.id);
  });

  it("returns null for an unknown code", () => {
    expect(getGiftCardByCode("DIVA-0000-0000")).toBeNull();
  });
});

describe("displayStatus", () => {
  it("maps balance/status/expiry to a display label", () => {
    const base = { status: "active" as const, initialCents: 15000, expiresAt: "2999-01-01T00:00:00Z" };
    expect(displayStatus({ ...base, balanceCents: 15000 })).toBe("active");
    expect(displayStatus({ ...base, balanceCents: 6000 })).toBe("partial");
    expect(displayStatus({ ...base, balanceCents: 0 })).toBe("empty");
    expect(displayStatus({ ...base, balanceCents: 15000, expiresAt: "2000-01-01T00:00:00Z" })).toBe("expired");
    expect(displayStatus({ ...base, balanceCents: 15000, status: "void" })).toBe("void");
  });
});
