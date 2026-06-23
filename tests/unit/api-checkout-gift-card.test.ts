import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, voidGiftCard } from "@/lib/gift-card-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-co-gc-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

async function post(code: string) {
  const { POST } = await import("@/app/api/checkout/gift-card/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  );
}

describe("POST /api/checkout/gift-card", () => {
  it("returns balance for a valid code", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const res = await post(card.code.toLowerCase());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.balanceCents).toBe(15000);
  });
  it("returns valid:false for a void/unknown code", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    voidGiftCard(card.id);
    const data = await (await post(card.code)).json();
    expect(data.valid).toBe(false);
    expect(data.reason).toBe("void");
  });
});
