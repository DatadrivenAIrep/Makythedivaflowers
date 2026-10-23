import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder } from "@/lib/order-storage";
import { addFuneralHome, listFuneralHomes, removeFuneralHome, recentFuneralAddresses } from "@/lib/funeral-homes";
import type { Order } from "@/types/order";
import type { Address } from "@/types/address";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-funeral-homes-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const WILLIAMS: Address = { street1: "200 Willis Ave", city: "Mineola", state: "NY", zip: "11501", country: "US" };
const OTHER: Address = { street1: "55 Main St", city: "Roslyn", state: "NY", zip: "11576", country: "US" };

let n = 0;
async function funeralOrder(address: Address, date: string, funeral = true) {
  await saveOrder({
    id: `o_${++n}`, source: "phone", locale: "es", funeral,
    lines: [{ kind: "custom", title: "Corona", priceCents: 25000, qty: 1 }],
    fulfillment: { method: "delivery", recipient: { name: "Familia Pérez", phone: "" }, address, window: { date, slot: "morning" } },
    contact: { name: "Ana", phone: "5165550100" },
    totals: { subtotalCents: 25000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 25000 },
    status: "delivered", paymentStatus: "paid",
    createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`,
  } as Order);
}

describe("funeral homes", () => {
  it("saves, lists by name and removes a funeral home", () => {
    addFuneralHome({ name: "Williams Funeral Home", phone: "(516) 555-0300", address: WILLIAMS });
    addFuneralHome({ name: "Austin F. Knowles", address: OTHER });
    const homes = listFuneralHomes();
    expect(homes.map((h) => h.name)).toEqual(["Austin F. Knowles", "Williams Funeral Home"]);
    expect(homes[1]).toMatchObject({ phone: "5165550300", address: WILLIAMS });
    removeFuneralHome(homes[0].id);
    expect(listFuneralHomes()).toHaveLength(1);
  });

  it("offers addresses of past funeral orders that are not saved yet, most used first", async () => {
    await funeralOrder(WILLIAMS, "2026-05-01");
    await funeralOrder({ ...WILLIAMS, street1: "200 WILLIS AVE." }, "2026-06-01");
    await funeralOrder(OTHER, "2026-07-01");
    await funeralOrder({ ...OTHER, street1: "9 Party Ln" }, "2026-08-01", false); // not a funeral
    expect(recentFuneralAddresses().map((a) => [a.address.city, a.orderCount])).toEqual([
      ["Mineola", 2],
      ["Roslyn", 1],
    ]);
    addFuneralHome({ name: "Williams Funeral Home", address: WILLIAMS });
    expect(recentFuneralAddresses().map((a) => a.address.city)).toEqual(["Roslyn"]);
  });
});

describe("/api/admin/funeral-homes", () => {
  it("creates, lists and deletes through the API", async () => {
    const { GET, POST, DELETE } = await import("@/app/api/admin/funeral-homes/route");
    const json = (b: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
    const created = await POST(new Request("http://x/api/admin/funeral-homes", json({ name: "Williams Funeral Home", address: WILLIAMS })));
    expect(created.status).toBe(201);
    const { homes } = await created.json();
    expect(homes).toHaveLength(1);
    expect((await (await GET()).json()).homes[0].name).toBe("Williams Funeral Home");
    const bad = await POST(new Request("http://x/api/admin/funeral-homes", json({ name: "X", address: WILLIAMS })));
    expect(bad.status).toBe(400);
    const del = await DELETE(new Request("http://x/api/admin/funeral-homes", { ...json({ id: homes[0].id }), method: "DELETE" }));
    expect((await del.json()).homes).toEqual([]);
  });
});
