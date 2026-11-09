import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Order } from "@/types/order";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

const lookupMock = vi.fn();
const createMock = vi.fn();
const redeemMock = vi.fn();
const stampMock = vi.fn();
const reverseMock = vi.fn();
vi.mock("@/lib/loyalty-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/loyalty-client")>();
  return {
    ...actual,
    lookupCustomer: (...a: unknown[]) => lookupMock(...a),
    createCustomer: (...a: unknown[]) => createMock(...a),
    redeemReward: (...a: unknown[]) => redeemMock(...a),
    addStamp: (...a: unknown[]) => stampMock(...a),
    reverseOrder: (...a: unknown[]) => reverseMock(...a),
  };
});

const getOrderMock = vi.fn();
vi.mock("@/lib/order-storage", () => ({ getOrder: (...a: unknown[]) => getOrderMock(...a) }));

const notifyMock = vi.fn();
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: (...a: unknown[]) => notifyMock(...a) }));

const sendSmsMock = vi.fn();
vi.mock("@/lib/twilio-server", async (orig) => {
  const actual = await orig<typeof import("@/lib/twilio-server")>();
  return { ...actual, sendSms: (...a: unknown[]) => sendSmsMock(...a) };
});

const smsEnabledMock = vi.fn();
const dryRunMock = vi.fn();
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => smsEnabledMock(),
  twilioDryRun: () => dryRunMock(),
}));

import { LoyaltyApiError } from "@/lib/loyalty-client";
import {
  enqueueOrderSync,
  enqueueOrderReverse,
  runSync,
  runReverse,
  runDuePending,
} from "@/lib/loyalty-sync";

const ORDER: Order = {
  id: "do_1",
  orderNumber: 1042,
  source: "web",
  locale: "es",
  lines: [],
  fulfillment: {
    method: "pickup",
    window: { date: "2026-08-21", slot: "morning" },
  } as Order["fulfillment"],
  contact: { name: "Bob Buyer", email: "", phone: "5165550100" },
  totals: { subtotalCents: 8000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 8000 },
  status: "pending",
  paymentStatus: "paid",
  createdAt: "2026-08-17T14:00:00Z",
  updatedAt: "2026-08-17T15:00:00Z",
};

const CUSTOMER = { id: 7, cardUrl: "https://card.example/c/abc", rewards: { available: [] } };

function row(orderId = "do_1", kind = "sync") {
  return getDb()
    .prepare("SELECT * FROM loyalty_sync WHERE order_id = ? AND kind = ?")
    .get(orderId, kind) as
    | { status: string; attempts: number; last_error: string | null; loyalty_order_id: string }
    | undefined;
}

function setup(order: Order = ORDER) {
  getOrderMock.mockResolvedValue(order);
  enqueueOrderSync(order);
}

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.example/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "k");
  runMigrations();
  for (const m of [lookupMock, createMock, redeemMock, stampMock, reverseMock, getOrderMock, notifyMock, sendSmsMock]) {
    m.mockReset();
  }
  lookupMock.mockResolvedValue(CUSTOMER);
  redeemMock.mockResolvedValue(undefined);
  stampMock.mockResolvedValue(undefined);
  reverseMock.mockResolvedValue({ rewardsAlreadyUsed: [] });
  sendSmsMock.mockResolvedValue({ sid: "SM1" });
  smsEnabledMock.mockReturnValue(true);
  dryRunMock.mockReturnValue(false);
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("enqueueOrderSync", () => {
  it("is a no-op when the connection is off, the order is not web or not paid", () => {
    vi.stubEnv("LOYALTY_API_KEY", "");
    enqueueOrderSync(ORDER);
    expect(row()).toBeUndefined();
    vi.stubEnv("LOYALTY_API_KEY", "k");
    enqueueOrderSync({ ...ORDER, source: "phone" } as unknown as Order);
    enqueueOrderSync({ ...ORDER, paymentStatus: "pending" });
    expect(row()).toBeUndefined();
  });

  it("keeps one row when called twice", () => {
    enqueueOrderSync(ORDER);
    enqueueOrderSync(ORDER);
    const n = getDb().prepare("SELECT COUNT(*) AS n FROM loyalty_sync").get() as { n: number };
    expect(n.n).toBe(1);
    expect(row()!.status).toBe("pending");
  });
});

describe("runSync", () => {
  it("redeems before stamping and uses diva-<orderNumber>", async () => {
    const calls: string[] = [];
    redeemMock.mockImplementation(async () => { calls.push("redeem"); });
    stampMock.mockImplementation(async () => { calls.push("stamp"); });
    setup({ ...ORDER, loyaltyRewardId: "r1" });
    await runSync("do_1");
    expect(calls).toEqual(["redeem", "stamp"]);
    expect(redeemMock).toHaveBeenCalledWith(7, "r1", "diva-1042", { timeoutMs: 10000 });
    expect(stampMock).toHaveBeenCalledWith(7, "diva-1042", { timeoutMs: 10000 });
    expect(lookupMock).toHaveBeenCalledWith("+15165550100", { timeoutMs: 10000 });
    expect(row()!.status).toBe("done");
  });

  it("falls back to diva-<id> when the order has no number and keeps it across retries", async () => {
    const noNumber = { ...ORDER, orderNumber: undefined };
    stampMock.mockRejectedValueOnce(new LoyaltyApiError("unavailable", 0));
    setup(noNumber);
    await runSync("do_1");
    // The number is assigned later; the id sent to the program must not change.
    getOrderMock.mockResolvedValue({ ...noNumber, orderNumber: 99 });
    await runSync("do_1");
    expect(stampMock.mock.calls.map((c) => c[1])).toEqual(["diva-do_1", "diva-do_1"]);
    expect(row()!.status).toBe("done");
  });

  it("creates the card only with loyaltyJoin, then stamps the same order", async () => {
    lookupMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ customer: CUSTOMER, existing: true });
    setup({ ...ORDER, loyaltyJoin: true });
    await runSync("do_1");
    expect(createMock).toHaveBeenCalledWith({ name: "Bob Buyer", phone: "+15165550100" }, { timeoutMs: 10000 });
    expect(stampMock).toHaveBeenCalledWith(7, "diva-1042", { timeoutMs: 10000 });
    expect(row()!.status).toBe("done");
  });

  it("does nothing for a buyer with no card and no consent, status noop", async () => {
    lookupMock.mockResolvedValue(null);
    setup(ORDER);
    await runSync("do_1");
    expect(createMock).not.toHaveBeenCalled();
    expect(stampMock).not.toHaveBeenCalled();
    expect(row()!.status).toBe("noop");
  });

  it("on reward_unavailable notifies the owner once and still stamps", async () => {
    redeemMock.mockRejectedValue(new LoyaltyApiError("reward_unavailable", 409));
    stampMock.mockRejectedValueOnce(new LoyaltyApiError("unavailable", 0));
    setup({ ...ORDER, loyaltyRewardId: "r1", loyaltyRewardLabel: "10% off" });
    await runSync("do_1");
    await runSync("do_1"); // retry hits reward_unavailable again
    expect(stampMock).toHaveBeenCalledTimes(2);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      'Orden #1042: el premio "10% off" ya se había usado al pagar. Se respetó el descuento. — Diva Flowers',
    );
    expect(row()!.status).toBe("done");
  });

  it("a failed stamp stays pending and the retry repeats both calls with the same orderId", async () => {
    stampMock.mockRejectedValueOnce(new LoyaltyApiError("unavailable", 0, "secret message 5165550100"));
    setup({ ...ORDER, loyaltyRewardId: "r1" });
    await runSync("do_1");
    expect(row()).toMatchObject({ status: "pending", attempts: 1, last_error: "unavailable" });
    await runSync("do_1");
    expect(redeemMock).toHaveBeenCalledTimes(2);
    expect(stampMock).toHaveBeenCalledTimes(2);
    expect(redeemMock.mock.calls.map((c) => c[2])).toEqual(["diva-1042", "diva-1042"]);
    expect(stampMock.mock.calls.map((c) => c[1])).toEqual(["diva-1042", "diva-1042"]);
    expect(row()!.status).toBe("done");
  });

  it("never throws, even when the order lookup or a non-API error blows up", async () => {
    setup(ORDER);
    getOrderMock.mockRejectedValue(new Error("db gone"));
    await expect(runSync("do_1")).resolves.toBeUndefined();
    getOrderMock.mockResolvedValue(ORDER);
    lookupMock.mockRejectedValue(new TypeError("boom 5165550100"));
    await expect(runSync("do_1")).resolves.toBeUndefined();
    expect(row()!.status).toBe("pending");
    expect(row()!.last_error).not.toContain("5165550100");
  });

  it("sends the card link once, only for a new card with smsConsent", async () => {
    lookupMock.mockResolvedValueOnce(null).mockResolvedValue(CUSTOMER);
    createMock.mockResolvedValue({ customer: CUSTOMER, existing: false });
    stampMock.mockRejectedValueOnce(new LoyaltyApiError("unavailable", 0));
    setup({ ...ORDER, loyaltyJoin: true, smsConsent: true, locale: "es" });
    await runSync("do_1");
    await runSync("do_1");
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    const [to, body] = sendSmsMock.mock.calls[0] as [string, string];
    expect(to).toBe("+15165550100");
    expect(body).toContain("Ya tienes tu tarjeta de Diva Flowers: https://card.example/c/abc");
  });

  it("uses the English text and sends nothing without smsConsent or for an existing card", async () => {
    lookupMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ customer: CUSTOMER, existing: false });
    setup({ ...ORDER, loyaltyJoin: true, smsConsent: true, locale: "en" });
    await runSync("do_1");
    expect((sendSmsMock.mock.calls[0] as [string, string])[1]).toContain(
      "Your Diva Flowers card is ready: https://card.example/c/abc",
    );

    sendSmsMock.mockReset();
    createMock.mockResolvedValue({ customer: CUSTOMER, existing: true });
    setup({ ...ORDER, id: "do_2", orderNumber: 2, loyaltyJoin: true, smsConsent: true });
    await runSync("do_2");
    createMock.mockResolvedValue({ customer: CUSTOMER, existing: false });
    setup({ ...ORDER, id: "do_3", orderNumber: 3, loyaltyJoin: true, smsConsent: false });
    await runSync("do_3");
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("logs instead of sending in dry-run", async () => {
    dryRunMock.mockReturnValue(true);
    lookupMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ customer: CUSTOMER, existing: false });
    setup({ ...ORDER, loyaltyJoin: true, smsConsent: true });
    await runSync("do_1");
    expect(sendSmsMock).not.toHaveBeenCalled();
    expect(row()!.status).toBe("done");
  });

  it("an SMS failure does not leave the sync pending", async () => {
    lookupMock.mockResolvedValue(null);
    createMock.mockResolvedValue({ customer: CUSTOMER, existing: false });
    sendSmsMock.mockRejectedValue(new Error("twilio down"));
    setup({ ...ORDER, loyaltyJoin: true, smsConsent: true });
    await runSync("do_1");
    expect(stampMock).toHaveBeenCalledTimes(1);
    expect(row()!.status).toBe("done");
  });

  it("is canceled when a reverse row exists", async () => {
    setup(ORDER);
    getDb()
      .prepare(
        `INSERT INTO loyalty_sync (order_id, kind, loyalty_order_id, status, created_at, updated_at)
         VALUES ('do_1','reverse','diva-1042','pending','2026-01-01','2026-01-01')`,
      )
      .run();
    await runSync("do_1");
    expect(row()!.status).toBe("canceled");
    expect(lookupMock).not.toHaveBeenCalled();
    expect(stampMock).not.toHaveBeenCalled();
  });
});

describe("runDuePending", () => {
  it("retries pending rows and counts the result", async () => {
    setup(ORDER);
    const r = await runDuePending();
    expect(r).toEqual({ done: 1, pending: 0, failed: 0 });
  });

  it("marks failed and notifies once after 72 hours", async () => {
    setup(ORDER);
    const later = new Date(Date.now() + 73 * 3600_000);
    const r = await runDuePending(later);
    expect(r).toEqual({ done: 0, pending: 0, failed: 1 });
    expect(row()!.status).toBe("failed");
    expect(lookupMock).not.toHaveBeenCalled();
    await runDuePending(later);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith(
      "Tarjeta: la orden #1042 no se pudo registrar en 72 horas. — Diva Flowers",
    );
  });

  it("keeps a row pending while the program is down within 72 hours", async () => {
    lookupMock.mockRejectedValue(new LoyaltyApiError("unavailable", 0));
    setup(ORDER);
    expect(await runDuePending()).toEqual({ done: 0, pending: 1, failed: 0 });
  });
});

describe("reverse", () => {
  it("enqueueOrderReverse does nothing after a noop sync or with no sync row", async () => {
    lookupMock.mockResolvedValue(null);
    setup(ORDER);
    await runSync("do_1");
    enqueueOrderReverse("do_1");
    enqueueOrderReverse("nope");
    expect(row("do_1", "reverse")).toBeUndefined();
    expect(row("nope", "reverse")).toBeUndefined();
  });

  it("enqueues a pending reverse reusing the loyalty order id", () => {
    setup(ORDER);
    enqueueOrderReverse("do_1");
    expect(row("do_1", "reverse")).toMatchObject({ status: "pending", loyalty_order_id: "diva-1042" });
  });

  it("treats order_not_found as done", async () => {
    reverseMock.mockRejectedValue(new LoyaltyApiError("order_not_found", 404));
    setup(ORDER);
    enqueueOrderReverse("do_1");
    await runReverse("do_1");
    expect(reverseMock).toHaveBeenCalledWith("diva-1042", { timeoutMs: 10000 });
    expect(row("do_1", "reverse")!.status).toBe("done");
  });

  it("notifies the owner when rewardsAlreadyUsed is not empty", async () => {
    reverseMock.mockResolvedValue({ rewardsAlreadyUsed: [{ reward: "10% off" }, { reward: "Free vase" }] });
    setup(ORDER);
    enqueueOrderReverse("do_1");
    await runReverse("do_1");
    expect(notifyMock).toHaveBeenCalledWith(
      "Orden #1042 cancelada: ya se usaron premios ganados con ella (10% off, Free vase). — Diva Flowers",
    );
    expect(row("do_1", "reverse")!.status).toBe("done");
  });

  it("keeps the reverse pending on an API failure and never throws", async () => {
    reverseMock.mockRejectedValue(new LoyaltyApiError("unavailable", 0));
    setup(ORDER);
    enqueueOrderReverse("do_1");
    await expect(runReverse("do_1")).resolves.toBeUndefined();
    expect(row("do_1", "reverse")).toMatchObject({ status: "pending", attempts: 1 });
  });
});
