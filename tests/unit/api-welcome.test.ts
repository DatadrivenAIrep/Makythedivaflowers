import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listPromos, getPromoByCode } from "@/lib/promo";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { WELCOME_PERCENT, WELCOME_MIN_SUBTOTAL_CENTS } from "@/lib/promo-grants";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => true,
  twilioDryRun: () => false,
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  sendSms.mockReset();
  sendSms.mockResolvedValue({ sid: "SM1" });
  __resetRateLimitForTests();
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

async function post(body: unknown, ip = "1.1.1.1") {
  const { POST } = await import("@/app/api/welcome/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

const good = { phone: "5165550100", locale: "es", marketingConsent: true };

describe("POST /api/welcome", () => {
  it("texts a code worth 10% off $75 or more", async () => {
    const res = await post(good);
    expect(res.status).toBe(200);
    expect(sendSms).toHaveBeenCalledTimes(1);

    const [, body] = sendSms.mock.calls[0];
    const code = (body as string).match(/HOLA-[A-Z0-9]+/)![0];
    const promo = getPromoByCode(code)!;
    expect(promo.value).toBe(WELCOME_PERCENT);
    expect(promo.minSubtotalCents).toBe(WELCOME_MIN_SUBTOTAL_CENTS);
    expect(promo.firstOrderOnly).toBe(true);
  });

  it("refuses without the marketing consent a marketing text requires", async () => {
    const res = await post({ ...good, marketingConsent: false });
    expect(res.status).toBe(400);
    expect(sendSms).not.toHaveBeenCalled();
    expect(listPromos()).toHaveLength(0);
  });

  it("refuses something that is not a phone number", async () => {
    expect((await post({ ...good, phone: "123" })).status).toBe(400);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("records the opt-in against a customer so campaigns can reach them", async () => {
    await post(good);
    const row = getDb()
      .prepare("SELECT id, order_count FROM customers WHERE phone LIKE ?")
      .get("%5165550100") as { id: string; order_count: number } | undefined;
    expect(row).toBeTruthy();
    const tags = getDb()
      .prepare("SELECT tag FROM customer_tags WHERE customer_id = ?")
      .all(row!.id)
      .map((t) => (t as { tag: string }).tag);
    expect(tags).toContain("sms-marketing");
  });

  it("does not make the CRM think they bought something", async () => {
    // Signing up is not an order; counting one would corrupt every segment
    // built on order_count.
    await post(good);
    const row = getDb()
      .prepare("SELECT order_count FROM customers WHERE phone LIKE ?")
      .get("%5165550100") as { order_count: number };
    expect(row.order_count).toBe(0);
  });

  it("does not mint a second offer for someone who taps twice", async () => {
    await post(good);
    await post(good);
    expect(listPromos()).toHaveLength(1);
  });

  it("stops someone using it to text a number repeatedly", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await post(good)).status);
    expect(statuses).toContain(429);
  });
});
