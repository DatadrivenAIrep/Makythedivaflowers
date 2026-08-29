import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { changeFulfillmentStatus } from "@/lib/order-mutations";

const dispatchOutForDeliveryMock = vi.fn();
const dispatchDeliveredMock = vi.fn();
vi.mock("@/lib/order-dispatch", () => ({
  dispatchOutForDelivery: (...a: unknown[]) => dispatchOutForDeliveryMock(...a),
  dispatchDelivered: (...a: unknown[]) => dispatchDeliveredMock(...a),
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  dispatchOutForDeliveryMock.mockReset();
  dispatchDeliveredMock.mockReset();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, status: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents, tax_cents,
       total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
       0,0,0,0, ?, 'paid', '2026-05-25T08:00:00Z', '2026-05-25T08:00:00Z')`,
  ).run(id, status);
}

describe("changeFulfillmentStatus", () => {
  it("advances pending → preparing", async () => {
    seed("o1", "pending");
    const r = await changeFulfillmentStatus("o1", "preparing");
    expect(r.status).toBe("preparing");
  });

  it("allows skipping forward pending → out-for-delivery", async () => {
    seed("o2", "pending");
    const r = await changeFulfillmentStatus("o2", "out-for-delivery");
    expect(r.status).toBe("out-for-delivery");
  });

  it("rejects backward transitions", async () => {
    seed("o3", "out-for-delivery");
    await expect(changeFulfillmentStatus("o3", "preparing")).rejects.toThrow(/invalid transition/);
  });

  it("is no-op when status is unchanged", async () => {
    seed("o4", "preparing");
    const r = await changeFulfillmentStatus("o4", "preparing");
    expect(r.status).toBe("preparing");
  });

  it("rejects unsupported statuses (failed, canceled) from this endpoint", async () => {
    seed("o5", "pending");
    await expect(changeFulfillmentStatus("o5", "canceled")).rejects.toThrow();
  });

  it("dispatches out_for_delivery on that transition", async () => {
    seed("o_ofd", "preparing");
    await changeFulfillmentStatus("o_ofd", "out-for-delivery");
    expect(dispatchOutForDeliveryMock).toHaveBeenCalledTimes(1);
    expect(dispatchDeliveredMock).not.toHaveBeenCalled();
  });

  it("dispatches delivered on that transition", async () => {
    seed("o_del", "out-for-delivery");
    await changeFulfillmentStatus("o_del", "delivered");
    expect(dispatchDeliveredMock).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch on other transitions", async () => {
    seed("o_prep", "pending");
    await changeFulfillmentStatus("o_prep", "preparing");
    expect(dispatchOutForDeliveryMock).not.toHaveBeenCalled();
    expect(dispatchDeliveredMock).not.toHaveBeenCalled();
  });

  it("a dispatch failure does not break the status change", async () => {
    dispatchOutForDeliveryMock.mockRejectedValueOnce(new Error("boom"));
    seed("o_fail", "preparing");
    const r = await changeFulfillmentStatus("o_fail", "out-for-delivery");
    expect(r.status).toBe("out-for-delivery");
  });
});
