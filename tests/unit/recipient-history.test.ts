import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder } from "@/lib/order-storage";
import { recipientsForSender, recipientProfile } from "@/lib/recipient-history";
import type { Order } from "@/types/order";
import type { Address } from "@/types/address";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-recipients-" + process.pid + ".json");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const ADDR_A = { street1: "1 Rose Ln", city: "Glen Cove", state: "NY", zip: "11542", country: "US" as const };
const ADDR_B = { street1: "9 Tulip Ct", city: "Bayville", state: "NY", zip: "11709", country: "US" as const };

let n = 0;
function order(p: {
  sender: { name: string; phone: string; customerId?: string };
  recipient: { name: string; phone: string };
  address?: Address;
  date: string;
  source?: Order["source"];
  status?: Order["status"];
  paymentStatus?: Order["paymentStatus"];
}): Order {
  n += 1;
  const window = { date: p.date, slot: "midday" as const };
  return {
    id: `o_${n}`,
    source: p.source ?? "phone",
    locale: "es",
    customerId: p.sender.customerId,
    lines: [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }],
    fulfillment: p.address
      ? { method: "delivery", recipient: p.recipient, address: p.address, window }
      : { method: "pickup", recipient: p.recipient, window },
    contact: { name: p.sender.name, phone: p.sender.phone },
    totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
    status: p.status ?? "delivered",
    paymentStatus: p.paymentStatus ?? "paid",
    createdAt: `${p.date}T12:00:00.000Z`,
    updatedAt: `${p.date}T12:00:00.000Z`,
  };
}

const ANA = { name: "Ana", phone: "5165550100", customerId: "cus_ana" };
const LUIS = { name: "Luis", phone: "5165550200" };

describe("recipientsForSender", () => {
  it("groups a sender's orders by recipient phone, newest first, with the latest address", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, address: ADDR_A, date: "2026-05-10" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Mami", phone: "5165559999" }, address: ADDR_B, date: "2026-08-01" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Sofía", phone: "5165558888" }, address: ADDR_A, date: "2026-06-01" }));

    const list = recipientsForSender({ customerId: "cus_ana", phone: ANA.phone });
    expect(list.map((r) => r.phone)).toEqual(["5165559999", "5165558888"]);
    expect(list[0]).toMatchObject({ name: "Mami", orderCount: 2, lastDate: "2026-08-01", lastAddress: ADDR_B });
    expect(list[1]).toMatchObject({ name: "Sofía", orderCount: 1 });
  });

  it("finds orders by the sender's phone when they were never linked to the customer", async () => {
    await saveOrder(order({ sender: { name: "Ana", phone: "(516) 555-0100" }, recipient: { name: "Mamá", phone: "5165559999" }, date: "2026-05-10" }));
    expect(recipientsForSender({ phone: "5165550100" })).toHaveLength(1);
  });

  it("matches a stored phone with a leading 1 or punctuation", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "1-516-555-9999" }, date: "2026-05-10" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, date: "2026-06-10" }));
    const list = recipientsForSender({ phone: ANA.phone });
    expect(list).toHaveLength(1);
    expect(list[0].orderCount).toBe(2);
  });

  it("leaves out orders the sender bought for themselves, canceled orders and unpaid web checkouts", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Ana", phone: ANA.phone }, date: "2026-05-10" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "X", phone: "5165557777" }, date: "2026-05-11", status: "canceled" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Y", phone: "5165556666" }, date: "2026-05-12", source: "web", paymentStatus: "pending" }));
    expect(recipientsForSender({ phone: ANA.phone })).toEqual([]);
  });

  it("keeps recipients without a usable phone apart by name", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Abuela", phone: "" }, date: "2026-05-10" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "abuela ", phone: "" }, date: "2026-05-11" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Tía", phone: "" }, date: "2026-05-12" }));
    const list = recipientsForSender({ phone: ANA.phone });
    expect(list).toHaveLength(2);
    expect(list.find((r) => r.name.toLowerCase().startsWith("abuela"))?.orderCount).toBe(2);
  });

  it("returns nothing for a short or empty phone and no customer id", () => {
    expect(recipientsForSender({ phone: "123" })).toEqual([]);
  });
});

describe("recipientProfile", () => {
  it("summarizes everything sent to a phone and who sent it", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, address: ADDR_A, date: "2026-05-10" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, address: ADDR_A, date: "2026-06-10" }));
    await saveOrder(order({ sender: LUIS, recipient: { name: "Carmen", phone: "516-555-9999" }, address: ADDR_B, date: "2026-07-01" }));

    const p = recipientProfile("(516) 555-9999");
    expect(p).toMatchObject({ name: "Carmen", orderCount: 3, lastDate: "2026-07-01", lastAddress: ADDR_B });
    expect(p?.senders).toEqual([
      { name: "Ana", phone: "5165550100", customerId: "cus_ana", orderCount: 2 },
      { name: "Luis", phone: "5165550200", orderCount: 1 },
    ]);
  });

  it("lists every distinct address, newest first, merging spelling variants", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, address: ADDR_A, date: "2026-03-01" }));
    await saveOrder(order({ sender: LUIS, recipient: { name: "Mamá", phone: "5165559999" }, address: ADDR_B, date: "2026-05-01" }));
    await saveOrder(order({
      sender: ANA, recipient: { name: "Mamá", phone: "5165559999" },
      address: { ...ADDR_A, street1: "1  ROSE LN." }, date: "2026-04-01",
    }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, date: "2026-06-01" })); // pickup

    const p = recipientProfile("5165559999");
    expect(p?.addresses.map((a) => [a.address.city, a.orderCount, a.lastDate])).toEqual([
      ["Bayville", 1, "2026-05-01"],
      ["Glen Cove", 2, "2026-04-01"],
    ]);
    expect(p?.lastAddress).toEqual(ADDR_B);
  });

  it("keeps an apartment as its own address", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, address: ADDR_A, date: "2026-03-01" }));
    await saveOrder(order({ sender: ANA, recipient: { name: "Mamá", phone: "5165559999" }, address: { ...ADDR_A, street2: "Apt 2" }, date: "2026-04-01" }));
    expect(recipientProfile("5165559999")?.addresses).toHaveLength(2);
  });

  it("returns null for a phone nobody has sent to", async () => {
    await saveOrder(order({ sender: ANA, recipient: { name: "Ana", phone: ANA.phone }, date: "2026-05-10" }));
    expect(recipientProfile(ANA.phone)).toBeNull();
    expect(recipientProfile("12")).toBeNull();
  });
});
