import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loyaltyEnabled, lookupCustomer, createCustomer, reverseOrder, addStamp, redeemReward, LoyaltyApiError,
} from "@/lib/loyalty-client";

const customer = { id: 42, cardUrl: "https://x/c/1", rewards: { available: [] } };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.test/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "tf_live_secret");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("loyalty client", () => {
  it("sends Bearer key and phone in the body, never in the URL", async () => {
    fetchMock.mockResolvedValue(json({ customer }));
    await lookupCustomer("+573001234567", { timeoutMs: 2500 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://loyalty.test/api/v1/customers/lookup");
    expect(url).not.toContain("573001234567");
    expect(init.headers.Authorization).toBe("Bearer tf_live_secret");
    expect(JSON.parse(init.body)).toEqual({ phone: "+573001234567" });
  });

  it("lookupCustomer returns null on 404 customer_not_found", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "customer_not_found", message: "x" } }, 404));
    expect(await lookupCustomer("+1", { timeoutMs: 100 })).toBeNull();
  });

  it("maps a non-JSON 502 to LoyaltyApiError code unavailable", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(lookupCustomer("+1", { timeoutMs: 100 })).rejects.toMatchObject({
      name: "LoyaltyApiError", code: "unavailable",
    });
  });

  it("maps an abort at timeoutMs to code unavailable", async () => {
    fetchMock.mockImplementation((_u: string, init: RequestInit) =>
      new Promise((_res, rej) => {
        init.signal!.addEventListener("abort", () => rej(init.signal!.reason));
      }));
    const err = await lookupCustomer("+1", { timeoutMs: 20 }).catch((e) => e);
    expect(err).toBeInstanceOf(LoyaltyApiError);
    expect(err.code).toBe("unavailable");
  });

  it("loyaltyEnabled is false when either variable is missing", () => {
    expect(loyaltyEnabled()).toBe(true);
    vi.stubEnv("LOYALTY_API_KEY", "");
    expect(loyaltyEnabled()).toBe(false);
    vi.stubEnv("LOYALTY_API_KEY", "k");
    vi.stubEnv("LOYALTY_API_URL", "");
    expect(loyaltyEnabled()).toBe(false);
  });

  it("reverseOrder percent-encodes the order id", async () => {
    fetchMock.mockResolvedValue(json({ customer, rewardsAlreadyUsed: [{ reward: "15%" }] }));
    const r = await reverseOrder("diva-a/b c", { timeoutMs: 100 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://loyalty.test/api/v1/orders/diva-a%2Fb%20c/reverse");
    expect(r.rewardsAlreadyUsed).toEqual([{ reward: "15%" }]);
  });

  it("passes the API error code through", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "reward_unavailable", message: "x" } }, 409));
    await expect(redeemReward(42, "final", "diva-1", { timeoutMs: 100 })).rejects.toMatchObject({
      code: "reward_unavailable", status: 409,
    });
  });

  it("createCustomer always sends consent true; addStamp sends the order id", async () => {
    fetchMock.mockResolvedValueOnce(json({ customer, existing: true }));
    const r = await createCustomer({ name: "Ana", phone: "+1" }, { timeoutMs: 100 });
    expect(r.existing).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Ana", phone: "+1", consent: true });
    fetchMock.mockResolvedValueOnce(json({ eventId: 1 }));
    await addStamp(42, "diva-9", { timeoutMs: 100 });
    expect(fetchMock.mock.calls[1][0]).toBe("https://loyalty.test/api/v1/customers/42/stamps");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ orderId: "diva-9", count: 1 });
  });

  describe("a 200 with an unexpected shape", () => {
    const malformed: [string, unknown][] = [
      ["an empty object", {}],
      ["customer null", { customer: null }],
      ["customer not an object", { customer: "x" }],
      ["id not a number", { customer: { ...customer, id: "42" } }],
      ["no rewards", { customer: { id: 42, cardUrl: "u" } }],
      ["rewards without available", { customer: { id: 42, cardUrl: "u", rewards: {} } }],
      ["available not an array", { customer: { id: 42, cardUrl: "u", rewards: { available: "no" } } }],
      ["a reward with no text", { customer: { id: 42, cardUrl: "u", rewards: { available: [{ id: "a" }] } } }],
      ["a null body", null],
    ];

    it.each(malformed)("lookupCustomer throws unavailable on %s", async (_name, body) => {
      fetchMock.mockResolvedValue(json(body));
      const err = await lookupCustomer("+1", { timeoutMs: 100 }).catch((e) => e);
      expect(err).toBeInstanceOf(LoyaltyApiError);
      expect(err).toMatchObject({ code: "unavailable", status: 0 });
    });

    it.each(malformed)("createCustomer throws unavailable on %s", async (_name, body) => {
      fetchMock.mockResolvedValue(json(body));
      const err = await createCustomer({ name: "Ana", phone: "+1" }, { timeoutMs: 100 }).catch((e) => e);
      expect(err).toBeInstanceOf(LoyaltyApiError);
      expect(err).toMatchObject({ code: "unavailable", status: 0 });
    });

    it("still accepts a well-formed customer", async () => {
      fetchMock.mockResolvedValue(json({ customer }));
      await expect(lookupCustomer("+1", { timeoutMs: 100 })).resolves.toEqual(customer);
    });
  });
});
