import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/admin/customers/[id]/date-suggestions/route";
import { closeDb } from "@/lib/db";
import { saveOrder } from "@/lib/order-storage";
import { upsertOnOrder } from "@/lib/customer-storage";
import { getCustomerProfile } from "@/lib/customer-profile";
import type { Order } from "@/types/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-datesugg-" + process.pid + ".json");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

async function seed(): Promise<string> {
  const c = upsertOnOrder({ name: "Ana", phone: "5165550100", orderAt: "2025-03-19T12:00:00Z" });
  for (const [i, date] of ["2025-03-19", "2026-03-21"].entries()) {
    await saveOrder({
      id: `o_${i}`, source: "phone", locale: "es", customerId: c.id,
      lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
      fulfillment: { method: "pickup", recipient: { name: "Mamá Rosa", phone: "5165550902" }, window: { date, slot: "midday" } },
      contact: { name: "Ana", phone: "5165550100" },
      totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
      status: "delivered", paymentStatus: "paid",
      createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`,
    } as Order);
  }
  return c.id;
}

function post(id: string, b: unknown) {
  return POST(
    new Request(`http://localhost/api/admin/customers/${id}/date-suggestions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("date suggestions", () => {
  it("shows up on the profile from a yearly pattern", async () => {
    const id = await seed();
    expect(getCustomerProfile(id)?.dateSuggestions).toMatchObject([
      { key: "5165550902:03-21", recipientName: "Mamá Rosa", month: 3, day: 21, years: [2025, 2026] },
    ]);
  });

  it("saves a suggestion as an important date and stops suggesting it", async () => {
    const id = await seed();
    const res = await post(id, { action: "save", key: "5165550902:03-21", kind: "birthday" });
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.dates).toMatchObject([{ kind: "birthday", label: "Mamá Rosa", month: 3, day: 21, recipientPhone: "5165550902" }]);
    expect(out.dateSuggestions).toEqual([]);
  });

  it("dismisses a suggestion for good", async () => {
    const id = await seed();
    const out = await (await post(id, { action: "dismiss", key: "5165550902:03-21" })).json();
    expect(out.dates).toEqual([]);
    expect(out.dateSuggestions).toEqual([]);
    expect(getCustomerProfile(id)?.dateSuggestions).toEqual([]);
  });

  it("rejects a key that is not a current suggestion", async () => {
    const id = await seed();
    expect((await post(id, { action: "save", key: "5165550902:12-25", kind: "birthday" })).status).toBe(404);
    expect((await post("cus_nope", { action: "dismiss", key: "x" })).status).toBe(404);
  });
});
