import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Order } from "@/types/order";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { __resetRateLimitForTests } from "@/lib/rate-limit";

// Uses the real API client over a stubbed fetch: the bug is what a 200 with the
// wrong shape does to everything downstream of the client.
const getOrderMock = vi.fn();
vi.mock("@/lib/order-storage", () => ({ getOrder: (...a: unknown[]) => getOrderMock(...a) }));
const notifyMock = vi.fn();
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: (...a: unknown[]) => notifyMock(...a) }));
vi.mock("@/lib/twilio-config", () => ({ twilioSmsEnabled: () => true, twilioDryRun: () => false }));

import { enqueueOrderSync, runSync } from "@/lib/loyalty-sync";
import { resolveRewardDiscount } from "@/lib/loyalty-checkout";
import { signProof } from "@/lib/loyalty-proof";
import { POST as lookupPOST } from "@/app/api/checkout/loyalty/lookup/route";

const ORDER: Order = {
  id: "do_1",
  orderNumber: 1042,
  source: "web",
  locale: "es",
  lines: [],
  fulfillment: { method: "pickup", window: { date: "2026-08-21", slot: "morning" } } as Order["fulfillment"],
  contact: { name: "Bob Buyer", email: "", phone: "5165550100" },
  totals: { subtotalCents: 8000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 8000 },
  status: "pending",
  paymentStatus: "paid",
  loyaltyJoin: true,
  createdAt: "2026-08-17T14:00:00Z",
  updatedAt: "2026-08-17T15:00:00Z",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.example/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "k");
  runMigrations();
  __resetRateLimitForTests();
  getOrderMock.mockReset().mockResolvedValue(ORDER);
  notifyMock.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function syncRow() {
  return getDb().prepare("SELECT * FROM loyalty_sync WHERE order_id = 'do_1' AND kind = 'sync'").get() as {
    status: string;
    attempts: number;
    last_error: string | null;
  };
}

describe("a 200 with an unexpected shape", () => {
  it.each([
    ["an empty object", {}],
    ["customer null", { customer: null }],
    ["no available rewards", { customer: { id: 7, cardUrl: "u" } }],
  ])("keeps the stamp pending on %s and creates no card", async (_name, body) => {
    fetchMock.mockResolvedValue(json(body));
    enqueueOrderSync(ORDER);
    await runSync("do_1");
    expect(syncRow()).toMatchObject({ status: "pending", attempts: 1, last_error: "unavailable" });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["https://loyalty.example/api/v1/customers/lookup"]);
  });

  it.each([
    ["an empty object", {}],
    ["no available rewards", { customer: { id: 7, cardUrl: "u" } }],
  ])("honours a valid proof at checkout on %s", async (_name, body) => {
    fetchMock.mockResolvedValue(json(body));
    const proof = signProof("5165550100", [{ id: "a", percent: 15, label: "15%" }]);
    await expect(
      resolveRewardDiscount({ phone: "5165550100", rewardId: "a", proof, subtotalCents: 10000 }),
    ).resolves.toEqual({ ok: true, rewardId: "a", label: "15%", percent: 15, discountCents: 1500 });
  });

  it.each([
    ["an empty object", {}],
    ["no available rewards", { customer: { id: 7, cardUrl: "u" } }],
  ])("the lookup route answers unavailable on %s", async (_name, body) => {
    fetchMock.mockResolvedValue(json(body));
    const res = await lookupPOST(
      new Request("http://t/lookup", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify({ phone: "5165550100" }),
      }),
    );
    expect(await res.json()).toEqual({ status: "unavailable" });
  });
});
