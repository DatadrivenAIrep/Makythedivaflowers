import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

vi.mock("@/lib/stripe-server", () => ({ stripe: { checkout: { sessions: { create: vi.fn() } } } }));
vi.mock("@/lib/order-dispatch", () => ({ dispatchOrderReceived: vi.fn() }));

import { POST } from "@/app/api/admin/orders/route";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, updateAccount, listContacts } from "@/lib/house-account-storage";
import { listEntries } from "@/lib/house-account-ledger";

const ORDER_FILE = path.join(os.tmpdir(), `diva-intake-acct-${process.pid}.json`);
const PRINT_FILE = path.join(os.tmpdir(), `diva-intake-acct-print-${process.pid}.json`);

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", ORDER_FILE);
  vi.stubEnv("PRINT_QUEUE_FILE", PRINT_FILE);
  vi.stubEnv("TWILIO_DRY_RUN", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  await fs.writeFile(ORDER_FILE, "[]");
  await fs.writeFile(PRINT_FILE, "[]");
  runMigrations();
});
afterEach(async () => {
  closeDb(); vi.unstubAllEnvs();
  try { await fs.unlink(ORDER_FILE); } catch {}
  try { await fs.unlink(PRINT_FILE); } catch {}
});

function body(accountId: string, extra: Record<string, unknown> = {}) {
  return {
    source: "phone",
    customer: { phone: "5165550100", name: "Ana López" },
    fulfillment: { method: "in-store" },
    lines: [{ kind: "custom", title: "Centro de mesa", priceCents: 5000, qty: 2 }],
    payment: { status: "account", accountId },
    ...extra,
  };
}
const req = (b: unknown) => new Request("http://localhost/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/admin/orders · payment.status = account", () => {
  it("creates a pending house-account order with a charge and links the buyer as a contact", async () => {
    const a = createAccount({ name: "Hotel" });
    const res = await POST(req(body(a.id)));
    expect(res.status).toBe(201);
    const { orderId } = await res.json();
    const row = getDb().prepare("SELECT payment_status, payment_method, house_account_id, total_cents, amount_paid_cents, customer_id FROM orders WHERE id = ?").get(orderId) as
      { payment_status: string; payment_method: string; house_account_id: string; total_cents: number; amount_paid_cents: number; customer_id: string };
    expect(row).toMatchObject({ payment_status: "pending", payment_method: "house-account", house_account_id: a.id, amount_paid_cents: 0 });
    const [charge] = listEntries(a.id);
    expect(charge).toMatchObject({ kind: "charge", orderId, amountCents: row.total_cents });
    expect(listContacts(a.id).map((c) => c.id)).toEqual([row.customer_id]);
  });
  it("422 for a paused or unknown account, and when combined with a gift card", async () => {
    const a = createAccount({ name: "Hotel" });
    updateAccount(a.id, { status: "paused" });
    const paused = await POST(req(body(a.id)));
    expect(paused.status).toBe(422);
    expect((await paused.json()).errors.formErrors).toEqual(["account_invalid"]);
    expect((await POST(req(body("ha_nope")))).status).toBe(422);
    const b = createAccount({ name: "Iglesia" });
    const gc = await POST(req(body(b.id, { giftCardCode: "DIVA-TEST-0000" })));
    expect(gc.status).toBe(422);
    expect((await gc.json()).errors.formErrors).toEqual(["account_gift_card"]);
    expect(listEntries(b.id)).toEqual([]);
  });
});
