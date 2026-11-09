import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { readProof } from "@/lib/loyalty-proof";

const lookupCustomer = vi.fn();
const loyaltyEnabled = vi.fn();
vi.mock("@/lib/loyalty-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/loyalty-client")>();
  return { ...actual, lookupCustomer: (...a: unknown[]) => lookupCustomer(...a), loyaltyEnabled: () => loyaltyEnabled() };
});
const smsEnabled = vi.fn();
const dryRun = vi.fn();
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => smsEnabled(), twilioDryRun: () => dryRun() }));
const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", async (orig) => {
  const actual = await orig<typeof import("@/lib/twilio-server")>();
  return { ...actual, sendSms: (...a: unknown[]) => sendSms(...a) };
});

const CUSTOMER = {
  id: 7,
  name: "Ana Perez",
  stamps: 3,
  visits: 9,
  cardUrl: "https://x/c/7",
  rewards: {
    available: [
      { id: "a", reward: "10% de descuento", final: false },
      { id: "b", reward: "Arreglo gratis", final: true },
      { id: "c", reward: "20% de descuento", final: false },
    ],
  },
};

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-co-loyalty-" + process.pid + ".json");
  vi.stubEnv("LOYALTY_API_KEY", "test-key");
  runMigrations();
  __resetRateLimitForTests();
  lookupCustomer.mockReset().mockResolvedValue(CUSTOMER);
  loyaltyEnabled.mockReset().mockReturnValue(true);
  smsEnabled.mockReset().mockReturnValue(true);
  dryRun.mockReset().mockReturnValue(false);
  sendSms.mockReset().mockResolvedValue({ sid: "SM1" });
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function req(url: string, body: unknown, ip = "1.1.1.1") {
  return new Request("http://t/" + url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}
async function lookup(body: unknown, ip?: string) {
  const { POST } = await import("@/app/api/checkout/loyalty/lookup/route");
  return POST(req("lookup", body, ip));
}
async function sendCode(body: unknown, ip?: string) {
  const { POST } = await import("@/app/api/checkout/loyalty/send-code/route");
  return POST(req("send-code", body, ip));
}
async function verify(body: unknown, ip?: string) {
  const { POST } = await import("@/app/api/checkout/loyalty/verify/route");
  return POST(req("verify", body, ip));
}
function sentCode(): string {
  const body = sendSms.mock.calls[0][1] as string;
  return body.match(/\d{6}/)![0];
}

describe("POST /api/checkout/loyalty/lookup", () => {
  it("lookup never includes name, stamps or visits", async () => {
    const res = await lookup({ phone: "(516) 555-0100" });
    const data = await res.json();
    expect(data.status).toBe("card");
    expect(data.rewards).toEqual([
      { id: "c", percent: 20, label: "20% de descuento" },
      { id: "a", percent: 10, label: "10% de descuento" },
    ]);
    const text = JSON.stringify(data);
    for (const leak of ["Ana", "stamps", "visits", "cardUrl", "customer"]) expect(text).not.toContain(leak);
    expect(lookupCustomer).toHaveBeenCalledWith("+15165550100", { timeoutMs: 2500 });
  });

  it("lookup returns unavailable when the API is down or the connection is off", async () => {
    lookupCustomer.mockRejectedValue(new Error("boom"));
    expect(await (await lookup({ phone: "5165550100" })).json()).toEqual({ status: "unavailable" });
    loyaltyEnabled.mockReturnValue(false);
    lookupCustomer.mockClear();
    expect(await (await lookup({ phone: "5165550100" })).json()).toEqual({ status: "unavailable" });
    expect(lookupCustomer).not.toHaveBeenCalled();
  });

  it("lookup with SMS off returns no_card or card with rewards []", async () => {
    smsEnabled.mockReturnValue(false);
    expect(await (await lookup({ phone: "5165550100" })).json()).toEqual({ status: "card", rewards: [] });
    lookupCustomer.mockResolvedValue(null);
    expect(await (await lookup({ phone: "5165550100" })).json()).toEqual({ status: "no_card" });
  });

  it("lookup returns no_card for an unknown phone", async () => {
    lookupCustomer.mockResolvedValue(null);
    expect(await (await lookup({ phone: "5165550100" })).json()).toEqual({ status: "no_card" });
  });

  it("lookup filters rewards with no percent", async () => {
    lookupCustomer.mockResolvedValue({
      ...CUSTOMER,
      rewards: { available: [{ id: "b", reward: "Arreglo gratis", final: true }] },
    });
    expect(await (await lookup({ phone: "5165550100" })).json()).toEqual({ status: "card", rewards: [] });
  });

  it("lookup rejects an invalid body and rate limits at 20 per minute per IP", async () => {
    expect((await lookup({ phone: "12" })).status).toBe(400);
    __resetRateLimitForTests();
    for (let i = 0; i < 20; i++) expect((await lookup({ phone: "5165550100" })).status).toBe(200);
    expect((await lookup({ phone: "5165550100" })).status).toBe(429);
    expect((await lookup({ phone: "5165550100" }, "2.2.2.2")).status).toBe(200);
  });
});

describe("POST /api/checkout/loyalty/send-code", () => {
  it("sends a Spanish or English SMS to the e164 number", async () => {
    expect(await (await sendCode({ phone: "(516) 555-0100", locale: "es" })).json()).toEqual({ sent: true });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sendSms.mock.calls[0][0]).toBe("+15165550100");
    expect(sendSms.mock.calls[0][1]).toMatch(/^Tu código de Diva Flowers es \d{6}\. Vence en 10 minutos\.$/);
    sendSms.mockClear();
    await sendCode({ phone: "5165550101", locale: "en" });
    expect(sendSms.mock.calls[0][1]).toMatch(/^Your Diva Flowers code is \d{6}\. It expires in 10 minutes\.$/);
  });

  it("send-code refuses the fourth send for one phone within the hour", async () => {
    for (let i = 0; i < 3; i++) expect((await sendCode({ phone: "5165550100", locale: "es" }, `9.9.9.${i}`)).status).toBe(200);
    const res = await sendCode({ phone: "(516) 555-0100", locale: "es" }, "9.9.9.9");
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ reason: "rate_limited" });
    expect(sendSms).toHaveBeenCalledTimes(3);
  });

  it("send-code limits each IP to 10 per minute", async () => {
    for (let i = 0; i < 10; i++) expect((await sendCode({ phone: `51655501${String(i).padStart(2, "0")}`, locale: "es" })).status).toBe(200);
    expect((await sendCode({ phone: "5165550199", locale: "es" })).status).toBe(429);
  });

  it("send-code sends nothing for a number with no rewards", async () => {
    lookupCustomer.mockResolvedValue(null);
    expect(await (await sendCode({ phone: "5165550100", locale: "es" })).json()).toEqual({ sent: true });
    lookupCustomer.mockResolvedValue({ ...CUSTOMER, rewards: { available: [] } });
    await sendCode({ phone: "5165550101", locale: "es" });
    lookupCustomer.mockRejectedValue(new Error("down"));
    await sendCode({ phone: "5165550102", locale: "es" });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("send-code failures are logged without the phone and the response is unchanged", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    sendSms.mockRejectedValue(new Error("twilio_not_configured"));
    const res = await sendCode({ phone: "(516) 555-0100", locale: "es" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(err).toHaveBeenCalledTimes(1);
    const args = JSON.stringify(err.mock.calls[0].map((a) => (a instanceof Error ? a.message : a)));
    expect(args).not.toMatch(/5165550100|516/);
  });

  it("lookup and verify log API failures", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    lookupCustomer.mockRejectedValue(new Error("revoked"));
    expect(await (await lookup({ phone: "5165550100" })).json()).toEqual({ status: "unavailable" });
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("send-code does nothing when SMS or the connection is off", async () => {
    smsEnabled.mockReturnValue(false);
    await sendCode({ phone: "5165550100", locale: "es" });
    smsEnabled.mockReturnValue(true);
    loyaltyEnabled.mockReturnValue(false);
    await sendCode({ phone: "5165550101", locale: "es" });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("in dry run the code goes to console.log instead of Twilio", async () => {
    dryRun.mockReturnValue(true);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendCode({ phone: "5165550100", locale: "en" });
    expect(sendSms).not.toHaveBeenCalled();
    const line = JSON.parse(log.mock.calls[0][0] as string);
    expect(line.to).toBe("+15165550100");
    expect(line.body).toMatch(/^Your Diva Flowers code is \d{6}\./);
  });
});

describe("POST /api/checkout/loyalty/verify", () => {
  it("verify returns a proof containing only applicable rewards", async () => {
    await sendCode({ phone: "5165550100", locale: "es" });
    const res = await verify({ phone: "(516) 555-0100", code: sentCode() });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.rewards.map((r: { id: string }) => r.id)).toEqual(["c", "a"]);
    expect(readProof(data.proof, "5165550100")?.rewards).toEqual(data.rewards);
    expect(lookupCustomer).toHaveBeenLastCalledWith("+15165550100", { timeoutMs: 2500 });
  });

  it("verify rejects a wrong code and a used code with 400", async () => {
    await sendCode({ phone: "5165550100", locale: "es" });
    const code = sentCode();
    const wrong = code === "000000" ? "111111" : "000000";
    const bad = await verify({ phone: "5165550100", code: wrong });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ reason: "wrong" });
    expect((await verify({ phone: "5165550100", code })).status).toBe(200);
    const again = await verify({ phone: "5165550100", code });
    expect(again.status).toBe(400);
    expect((await again.json()).reason).toMatch(/wrong|expired/);
  });

  it("verify answers 503 when the API fails", async () => {
    await sendCode({ phone: "5165550100", locale: "es" });
    lookupCustomer.mockRejectedValue(new Error("down"));
    const res = await verify({ phone: "5165550100", code: sentCode() });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ reason: "unavailable" });
  });

  it("verify answers 503 when the connection is off", async () => {
    loyaltyEnabled.mockReturnValue(false);
    const res = await verify({ phone: "5165550100", code: "123456" });
    expect(res.status).toBe(503);
  });
});
