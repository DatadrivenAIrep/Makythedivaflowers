import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

// notifyGiftCardIssued hits Resend; stub it so the route is testable offline.
vi.mock("@/lib/gift-card-notifications", () => ({
  notifyGiftCardIssued: vi.fn(async () => ({ sent: true })),
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-api-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function importRoute() {
  return await import("@/app/api/admin/gift-cards/route");
}

describe("POST /api/admin/gift-cards", () => {
  it("issues a card, emails it, and returns the code", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://t/api/admin/gift-cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 15000, recipientEmail: "maria@example.com", recipientName: "María" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.card.code).toMatch(/^DIVA-/);
    expect(data.emailSent).toBe(true);

    const { notifyGiftCardIssued } = await import("@/lib/gift-card-notifications");
    expect(notifyGiftCardIssued).toHaveBeenCalledOnce();
  });

  it("rejects a bad payload with 400", async () => {
    const { POST } = await importRoute();
    const req = new Request("http://t/api/admin/gift-cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 999, recipientEmail: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/gift-cards", () => {
  it("lists cards with stats", async () => {
    const { POST, GET } = await importRoute();
    await POST(
      new Request("http://t", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: 15000, recipientEmail: "a@b.com" }),
      }),
    );
    const res = await GET();
    const data = await res.json();
    expect(data.cards.length).toBe(1);
    expect(data.stats.issuedCents).toBe(15000);
  });
});
