import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { recordPaymentRow } from "@/lib/payments-storage";
import { GET, PUT } from "@/app/api/admin/cash-close/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const DAY = "2026-10-16";
const get = (day = DAY) => GET(new Request(`http://x/api/admin/cash-close?day=${day}`));
const put = (b: unknown) =>
  PUT(new Request("http://x/api/admin/cash-close", { method: "PUT", body: JSON.stringify(b), headers: { "content-type": "application/json" } }));
const pay = (method: "cash" | "zelle", amountCents: number, at: string) =>
  recordPaymentRow({ kind: "payment", method, amountCents, source: "mark_paid", actor: "maky", at });

function insertOrder(o: {
  id: string; createdAt: string; total: number; paid: number; status: "pending" | "paid"; fulfillment?: string;
  subtotal?: number; tax?: number; tip?: number | null; delivery?: number; discount?: number | null; number?: number; name?: string;
}) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_name, contact_phone, fulfillment_method,
       lines_json, subtotal_cents, delivery_cents, discount_cents, tip_cents, tax_cents, total_cents, amount_paid_cents,
       fulfillment_status, payment_status, order_number, created_at, updated_at)
     VALUES (?, 'en', 'admin', 'R', '5', ?, '5', 'delivery', '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(o.id, o.name ?? null, o.subtotal ?? 0, o.delivery ?? 0, o.discount ?? null, o.tip ?? null, o.tax ?? 0, o.total, o.paid,
    o.fulfillment ?? "new", o.status, o.number ?? null, o.createdAt, o.createdAt);
}

describe("GET/PUT /api/admin/cash-close", () => {
  it("summarizes the day, saves a close and ignores client totals", async () => {
    pay("cash", 5000, "2026-10-16T15:00:00.000Z");
    pay("zelle", 3000, "2026-10-16T16:00:00.000Z");

    const first = await (await get()).json();
    expect(first.day).toBe(DAY);
    expect(first.firstDay).toBe(DAY);
    expect(first.summary.totalCollectedCents).toBe(8000);
    expect(first.payments.map((p: { amountCents: number }) => p.amountCents)).toEqual([5000, 3000]);
    expect(first.close).toBeNull();
    expect(first.changeSinceCloseCents).toBe(0);
    expect(first.previousFloatCents).toBe(0);
    expect(first.history).toEqual([]);

    const res = await put({
      day: DAY, openingFloatCents: 10000, cashOutCents: 500, countedCents: 14000, floatLeftCents: 10000,
      reviewed: ["zelle"], expectedCents: 1, junk: true,
    });
    expect(res.status).toBe(200);
    const { close } = await res.json();
    expect(close.expectedCents).toBe(14500);
    expect(close.differenceCents).toBe(-500);
    expect(close.cashInCents).toBe(5000);
    expect(close.reviewed).toEqual(["zelle"]);
    expect(close.totals.totalCollectedCents).toBe(8000);
    expect(close.actor).toBe("maky");

    await new Promise((r) => setTimeout(r, 5));
    const again = await (await put({
      day: DAY, openingFloatCents: 10000, cashOutCents: 500, cashOutNote: "flores", countedCents: 14500, floatLeftCents: 10000, reviewed: [], note: "ok",
    })).json();
    expect(again.close.createdAt).toBe(close.createdAt);
    expect(again.close.updatedAt).not.toBe(close.updatedAt);
    expect(again.close.differenceCents).toBe(0);
    expect(again.close.cashOutNote).toBe("flores");
    expect(again.close.note).toBe("ok");

    pay("cash", 4000, "2026-10-16T17:00:00.000Z");
    const after = await (await get()).json();
    expect(after.changeSinceCloseCents).toBe(4000);
    expect(after.close.countedCents).toBe(14500);
    expect(after.history).toHaveLength(1);

    const next = await (await get("2026-10-17")).json();
    expect(next.previousFloatCents).toBe(10000);
    expect(next.close).toBeNull();
  });

  it("rejects an invalid body", async () => {
    const res = await put({ day: DAY, openingFloatCents: 0, cashOutCents: 0, countedCents: -1, floatLeftCents: 0, reviewed: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
    expect((await put({ day: DAY, openingFloatCents: 0, cashOutCents: 0, countedCents: 0, floatLeftCents: 0, reviewed: ["bitcoin"] })).status).toBe(400);
  });

  it("joins the order and orders same-instant payments by insertion", async () => {
    insertOrder({ id: "o1", createdAt: "2026-10-16T14:00:00.000Z", total: 100, paid: 100, status: "paid", number: 1234, name: "Ana" });
    recordPaymentRow({ kind: "payment", method: "cash", amountCents: 100, orderId: "o1", source: "mark_paid", actor: "maky", at: "2026-10-16T15:00:00.000Z" });
    pay("zelle", 7, "2026-10-16T15:00:00.000Z");
    pay("cash", 9, "2026-10-16T15:00:00.000Z");
    const { payments } = await (await get()).json();
    expect(payments.map((p: { amountCents: number }) => p.amountCents)).toEqual([100, 7, 9]);
    expect(payments[0]).toMatchObject({ orderNumber: 1234, customerName: "Ana" });
    expect(payments[1].orderNumber).toBeUndefined();
  });

  it("computes the day's sales in shop time, counting only pending balances as pending", async () => {
    // 2026-10-17T03:30Z is still Oct 16 in New York; 2026-10-17T05:00Z is Oct 17.
    insertOrder({ id: "a", createdAt: "2026-10-17T03:30:00.000Z", subtotal: 1000, tax: 86, tip: 100, delivery: 200, discount: 50, total: 1336, paid: 300, status: "pending" });
    insertOrder({ id: "b", createdAt: "2026-10-16T14:00:00.000Z", subtotal: 2000, tax: 172, tip: null, delivery: 0, discount: null, total: 2172, paid: 0, status: "paid" });
    insertOrder({ id: "c", createdAt: "2026-10-16T15:00:00.000Z", subtotal: 999, tax: 99, total: 999, paid: 0, status: "pending", fulfillment: "canceled" });
    insertOrder({ id: "d", createdAt: "2026-10-17T05:00:00.000Z", subtotal: 500, tax: 40, total: 540, paid: 0, status: "pending" });
    insertOrder({ id: "e", createdAt: "2026-10-16T16:00:00.000Z", subtotal: 100, tax: 0, total: 100, paid: 150, status: "pending" });
    const { sales } = await (await get()).json();
    expect(sales).toEqual({
      orders: 3, subtotalCents: 3100, taxCents: 258, tipCents: 100, deliveryCents: 200, discountCents: 50,
      pendingCents: 1036,
    });
  });
});
