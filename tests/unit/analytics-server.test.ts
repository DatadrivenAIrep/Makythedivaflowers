import { describe, it, expect, beforeEach, vi } from "vitest";
import { sendPurchaseToGA4 } from "@/lib/analytics-server";
import type { AnalyticsItem } from "@/lib/analytics-types";

const ITEM: AnalyticsItem = {
  item_id: "p1",
  item_name: "Lush Bouquet",
  item_category: "bouquets",
  item_variant: "lush",
  price: 80,
  quantity: 1,
  currency: "USD",
};

describe("sendPurchaseToGA4", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env.GA4_MEASUREMENT_ID = "G-TEST123";
    process.env.GA4_API_SECRET = "secret-abc";
  });

  it("posts the correct Measurement Protocol payload", async () => {
    await sendPurchaseToGA4({
      clientId: "1234.5678",
      transaction_id: "ord_abc",
      value: 100,
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https:\/\/www\.google-analytics\.com\/mp\/collect\?/);
    expect(url).toContain("measurement_id=G-TEST123");
    expect(url).toContain("api_secret=secret-abc");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      client_id: "1234.5678",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: "ord_abc",
            value: 100,
            currency: "USD",
            tax: 8.88,
            shipping: 12,
            items: [ITEM],
          },
        },
      ],
    });
  });

  it("returns silently when GA4 env vars are missing", async () => {
    delete process.env.GA4_MEASUREMENT_ID;
    await sendPurchaseToGA4({
      clientId: "1234.5678",
      transaction_id: "ord_abc",
      value: 100,
      tax: 8.88,
      shipping: 12,
      items: [ITEM],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw if fetch fails (fire-and-forget)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(
      sendPurchaseToGA4({
        clientId: "1234.5678",
        transaction_id: "ord_abc",
        value: 100,
        tax: 8.88,
        shipping: 12,
        items: [ITEM],
      }),
    ).resolves.toBeUndefined();
  });
});
