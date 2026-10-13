import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { saveOrder, getOrder } from "@/lib/order-storage";
import { editOrder } from "@/lib/order-edit";
import { listOrderHistory } from "@/lib/order-history";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", `/tmp/orders-ete-${Math.random().toString(36).slice(2)}.json`);
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function base(id: string, over: Partial<Order> = {}): Order {
  return {
    id, source: "phone", locale: "es",
    lines: [{ kind: "custom", title: "Altar", priceCents: 5000, qty: 1 }],
    fulfillment: { method: "pickup", recipient: { name: "Iglesia", phone: "5165550100" }, window: { date: "2026-10-20", slot: "midday" } },
    contact: { phone: "5165550100" },
    totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
    status: "pending", paymentStatus: "pending",
    taxExempt: { cert: "CUS-1" },
    createdAt: "2026-10-12T12:00:00Z", updatedAt: "2026-10-12T12:00:00Z",
    ...over,
  };
}

describe("editOrder and tax exemption", () => {
  it("an exempt order stays tax-free after an unrelated edit", async () => {
    await saveOrder(base("x1"));
    const { order } = await editOrder("x1", { lines: [{ kind: "custom", title: "Altar", priceCents: 5000, qty: 2 }] }, "maky");
    expect(order.totals.taxCents).toBe(0);
    expect(order.totals.totalCents).toBe(10000);
    expect(order.taxExempt).toEqual({ cert: "CUS-1" });
  });

  it("an exempt order with a discount and a tip keeps them and stays tax-free after an unrelated edit", async () => {
    await saveOrder(base("x5", { totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 500, tipCents: 300, taxCents: 0, totalCents: 4800 } }));
    const { order } = await editOrder("x5", { cardMessage: "Con cariño" }, "maky");
    expect(order.totals.taxCents).toBe(0);
    expect(order.totals.discountCents).toBe(500);
    expect(order.totals.tipCents).toBe(300);
    expect(order.totals.totalCents).toBe(4800);
    expect(order.taxExempt).toEqual({ cert: "CUS-1" });
  });

  it("switching it off adds tax and records the change", async () => {
    await saveOrder(base("x2"));
    const { order } = await editOrder("x2", { taxExempt: { taxExempt: false } }, "maky");
    expect(order.totals.taxCents).toBe(Math.round(5000 * 0.08625));
    expect(order.totals.totalCents).toBe(5000 + Math.round(5000 * 0.08625));
    expect((await getOrder("x2"))?.taxExempt).toBeUndefined();
    const diff = (await listOrderHistory("x2"))[0].changes?.find((c) => c.field === "taxExempt");
    expect(diff).toMatchObject({ before: "sí · CUS-1", after: "no" });
  });

  it("switching it on needs a certificate", async () => {
    await saveOrder(base("x3", { taxExempt: undefined, totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 431, totalCents: 5431 } }));
    await expect(editOrder("x3", { taxExempt: { taxExempt: true } }, "maky")).rejects.toThrow("tax_exempt_cert_required");
    const { order } = await editOrder("x3", { taxExempt: { taxExempt: true, cert: "NEW-1" } }, "maky");
    expect(order.taxExempt).toEqual({ cert: "NEW-1" });
    expect(order.totals.totalCents).toBe(5000);
  });

  it("the PATCH route accepts taxExempt and 400s without a cert", async () => {
    await saveOrder(base("x4", { taxExempt: undefined }));
    const { PATCH } = await import("@/app/api/admin/orders/[id]/route");
    const call = (b: unknown) => PATCH(
      new Request("http://x", { method: "PATCH", headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` }, body: JSON.stringify(b) }),
      { params: Promise.resolve({ id: "x4" }) },
    );
    const bad = await call({ taxExempt: { taxExempt: true } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("tax_exempt_cert_required");
    expect((await call({ taxExempt: { taxExempt: true, cert: "Z" } })).status).toBe(200);
  });
});
