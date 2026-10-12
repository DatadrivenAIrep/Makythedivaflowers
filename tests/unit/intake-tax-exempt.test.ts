import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getOrder } from "@/lib/order-storage";
import { createAccount } from "@/lib/house-account-storage";

vi.mock("@/lib/print-queue", () => ({ enqueuePrintJob: vi.fn(async () => ({ id: "pj_test" })) }));
vi.mock("@/lib/order-notifications", () => ({ notifyOrderPaid: vi.fn(async () => {}) }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived: vi.fn(async () => {}) }));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-intake-te-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

const PHONE = "5165550100";
const SUBTOTAL = 5000;

function body(extra: Record<string, unknown> = {}, payment: Record<string, unknown> = { status: "paid", method: "cash" }) {
  return {
    source: "phone",
    customer: { name: "Iglesia San Juan", phone: PHONE, messagingChannel: "none" },
    fulfillment: { method: "pickup", recipient: { name: "Iglesia", phone: PHONE }, window: { date: "2026-10-20", slot: "midday" } },
    lines: [{ kind: "custom", title: "Altar", priceCents: SUBTOTAL, qty: 1 }],
    payment,
    ...extra,
  };
}
async function post(b: unknown) {
  const { POST } = await import("@/app/api/admin/orders/route");
  return POST(new Request("http://t", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));
}
function seedExemptCustomer(cert = "CUS-1", expires: string | null = null) {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at, tax_exempt, tax_exempt_cert, tax_exempt_expires)
     VALUES ('c1', 'Iglesia San Juan', ?, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 1, ?, ?)`,
  ).run(PHONE, cert, expires);
}

describe("intake with tax exemption", () => {
  it("applies the buyer's exemption by default and snapshots it", async () => {
    seedExemptCustomer();
    const res = await post(body());
    expect(res.status).toBe(201);
    const order = await getOrder((await res.json()).orderId);
    expect(order?.totals.taxCents).toBe(0);
    expect(order?.totals.totalCents).toBe(SUBTOTAL);
    expect(order?.taxExempt).toEqual({ cert: "CUS-1" });
  });

  it("an expired certificate is not applied", async () => {
    seedExemptCustomer("CUS-1", "2020-01-01");
    const order = await getOrder((await (await post(body())).json()).orderId);
    expect(order?.totals.taxCents).toBe(Math.round(SUBTOTAL * 0.08625));
    expect(order?.taxExempt).toBeUndefined();
  });

  it("staff can switch it off for one order", async () => {
    seedExemptCustomer();
    const order = await getOrder((await (await post(body({ taxExempt: { taxExempt: false } }))).json()).orderId);
    expect(order?.totals.taxCents).toBeGreaterThan(0);
    expect(order?.taxExempt).toBeUndefined();
  });

  it("a one-off exemption needs a certificate", async () => {
    const bad = await post(body({ taxExempt: { taxExempt: true } }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).errors.formErrors).toContain("tax_exempt_cert_required");
    const ok = await post(body({ taxExempt: { taxExempt: true, cert: "ONE-OFF" } }));
    const order = await getOrder((await ok.json()).orderId);
    expect(order?.taxExempt).toEqual({ cert: "ONE-OFF" });
    expect(order?.totals.taxCents).toBe(0);
  });

  it("the house account's certificate wins over the buyer's", async () => {
    seedExemptCustomer("CUS-1");
    const acct = createAccount({ name: "Diócesis", taxExemption: { exempt: true, cert: "ACC-9" } }, "2026-10-01");
    const res = await post(body({}, { status: "account", accountId: acct.id }));
    expect(res.status).toBe(201);
    const order = await getOrder((await res.json()).orderId);
    expect(order?.taxExempt).toEqual({ cert: "ACC-9" });
    // The account is charged the tax-free total.
    const charge = getDb().prepare("SELECT amount_cents FROM house_account_entries WHERE order_id = ? AND kind = 'charge'").get(order!.id) as { amount_cents: number };
    expect(charge.amount_cents).toBe(SUBTOTAL);
  });

  it("a manual tax override cannot re-add tax to an exempt order", async () => {
    seedExemptCustomer();
    const order = await getOrder((await (await post(body({ totalsOverride: { taxCents: 431 } }))).json()).orderId);
    expect(order?.totals.taxCents).toBe(0);
  });
});

describe("GET /api/admin/tax-exempt/default", () => {
  async function get(qs: string) {
    const { GET } = await import("@/app/api/admin/tax-exempt/default/route");
    return (await GET(new Request(`http://t/api/admin/tax-exempt/default?${qs}`))).json();
  }
  it("returns the customer's default", async () => {
    seedExemptCustomer();
    expect(await get(`phone=${PHONE}`)).toEqual({ default: { cert: "CUS-1", source: "customer" }, expired: false });
  });
  it("prefers the account and flags an expired one", async () => {
    seedExemptCustomer("CUS-1", "2020-01-01");
    expect(await get(`phone=${PHONE}`)).toEqual({ default: null, expired: true });
    const acct = createAccount({ name: "Diócesis", taxExemption: { exempt: true, cert: "ACC-9" } }, "2026-10-01");
    expect(await get(`phone=${PHONE}&accountId=${acct.id}`)).toEqual({ default: { cert: "ACC-9", source: "account" }, expired: false });
  });
  it("nothing for an unknown phone", async () => {
    expect(await get("phone=5165559999")).toEqual({ default: null, expired: false });
  });
});
