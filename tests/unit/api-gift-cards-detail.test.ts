import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { issueGiftCard, getGiftCardById } from "@/lib/gift-card-storage";

vi.mock("@/lib/gift-card-notifications", () => ({
  notifyGiftCardIssued: vi.fn(async () => ({ sent: true })),
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-gc-detail-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("gift card detail / void / resend", () => {
  it("GET returns the card + history", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { GET } = await import("@/app/api/admin/gift-cards/[id]/route");
    const res = await GET(new Request("http://t"), ctx(card.id));
    const data = await res.json();
    expect(data.card.id).toBe(card.id);
    expect(Array.isArray(data.redemptions)).toBe(true);
  });

  it("void marks the card void", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { POST } = await import("@/app/api/admin/gift-cards/[id]/void/route");
    const res = await POST(new Request("http://t", { method: "POST" }), ctx(card.id));
    expect(res.status).toBe(200);
    expect(getGiftCardById(card.id)!.status).toBe("void");
  });

  it("resend re-sends the email", async () => {
    const card = issueGiftCard({ initialCents: 15000, recipientEmail: "a@b.com" });
    const { POST } = await import("@/app/api/admin/gift-cards/[id]/resend/route");
    const res = await POST(new Request("http://t", { method: "POST" }), ctx(card.id));
    expect(res.status).toBe(200);
    const { notifyGiftCardIssued } = await import("@/lib/gift-card-notifications");
    expect(notifyGiftCardIssued).toHaveBeenCalledOnce();
  });
});
