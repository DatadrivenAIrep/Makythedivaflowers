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

  it("a purchase needs the payment method, and with it logs the sale", async () => {
    const { POST } = await importRoute();
    const post = (extra: object) =>
      POST(new Request("http://t/api/admin/gift-cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: 5000, recipientEmail: "a@b.com", reason: "purchase", ...extra }),
      }));
    const bad = await post({});
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "payment_method_required" });
    const ok = await post({ paymentMethod: "zelle" });
    expect(ok.status).toBe(200);
    const { getDb } = await import("@/lib/db");
    const sale = getDb().prepare("SELECT kind, method, amount_cents AS amount FROM payments").all();
    expect(sale).toEqual([{ kind: "gift_card_sale", method: "zelle", amount: 5000 }]);
  });

  it("stores the optional email headline on the card", async () => {
    const { POST } = await importRoute();
    const res = await POST(
      new Request("http://t/api/admin/gift-cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountCents: 10000,
          recipientEmail: "hello@example.org",
          headline: "A gift for The Shelter Connection",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.card.headline).toBe("A gift for The Shelter Connection");
  });

  it("stores the co-brand partner and rejects an unknown one", async () => {
    const { POST } = await importRoute();
    const post = (partner: string) =>
      POST(
        new Request("http://t/api/admin/gift-cards", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amountCents: 10000, recipientEmail: "hello@example.org", partner }),
        }),
      );
    const ok = await post("the-shelter-connection");
    expect(ok.status).toBe(200);
    expect((await ok.json()).card.partner).toBe("the-shelter-connection");
    expect((await post("acme-inc")).status).toBe(400);
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
