import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import type { Order } from "@/types/order";
import type { Product } from "@/types/product";

const lookupMock = vi.fn();
vi.mock("@/lib/loyalty-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/loyalty-client")>();
  return { ...actual, lookupCustomer: (...a: unknown[]) => lookupMock(...a) };
});

const prod = (id: string, over: Partial<Product>): Product =>
  ({ id, category: "arrangements", occasions: ["birthday"], variants: [], ...over }) as unknown as Product;
vi.mock("@/lib/product-prices", () => ({
  getPricedProducts: () => [
    prod("p-normal", {}),
    prod("p-sym", { category: "sympathy", occasions: ["sympathy"] }),
    prod("p-gw", { occasions: ["get-well"] }),
    prod("p-gw-mix", { occasions: ["get-well", "birthday"] }),
    prod("p-sub", { subscription: { cadences: ["weekly"] } as Product["subscription"] }),
    prod("p-subcat", { category: "subscriptions" }),
  ],
}));

import { addImportantDate, findRecipientDate } from "@/lib/customer-dates-storage";
import { setDatePreferences } from "@/lib/date-preferences-storage";
import { addFuneralHome } from "@/lib/funeral-homes";
import { orderQualifiesForPrompt, promptQuestion, promptReward } from "@/lib/date-prompt";

const NOW = new Date("2026-11-10T12:00:00Z");
const BUYER = "5165550100";

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: "o1",
    source: "web",
    locale: "es",
    customerId: "c1",
    lines: [{ kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 }],
    fulfillment: {
      method: "pickup",
      recipient: { name: "Laura", phone: "5165559999" },
      window: { date: "2026-03-18", slot: "morning" },
    },
    contact: { name: "Ana", phone: BUYER },
    totals: { subtotalCents: 0, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 0 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-11-05T12:00:00Z",
    updatedAt: "2026-11-05T12:00:00Z",
    ...over,
  } as Order;
}

function seedCustomer(id: string) {
  const at = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO customers (id, name, phone, first_seen_at, last_seen_at) VALUES (?, 'Ana', ?, ?, ?)")
    .run(id, BUYER, at, at);
}

function seedSync(orderId: string, status: string) {
  const at = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO loyalty_sync (order_id, kind, loyalty_order_id, status, created_at, updated_at) VALUES (?, 'sync', 'x', ?, ?, ?)",
    )
    .run(orderId, status, at, at);
}

function seedBonus(slot: string) {
  const at = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO loyalty_bonus (customer_id, slot, status, created_at, updated_at) VALUES ('c1', ?, 'pending', ?, ?)")
    .run(slot, at, at);
}

function card(next?: { at: number; reward: string; remaining: number }) {
  return { id: 77, cardUrl: "https://card.example/c/x", rewards: { available: [], ...(next ? { next } : {}) } };
}

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.example/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "k");
  vi.stubEnv("DATE_REWARDS_ENABLED", "1");
  runMigrations();
  lookupMock.mockReset();
  seedCustomer("c1");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("orderQualifiesForPrompt", () => {
  it("un pedido normal califica", () => {
    expect(orderQualifiesForPrompt(makeOrder(), NOW)).toBe(true);
  });
  it("hace 30 días todavía califica", () => {
    expect(orderQualifiesForPrompt(makeOrder({ createdAt: "2026-10-11T12:00:00Z" }), NOW)).toBe(true);
  });
  it.each<[string, Partial<Order>]>([
    ["sin pagar", { paymentStatus: "pending" }],
    ["cancelado", { status: "canceled" }],
    ["31 días", { createdAt: "2026-10-10T11:00:00Z" }],
    ["sin customerId", { customerId: undefined }],
    ["source phone", { source: "phone" }],
    ["funeral", { funeral: true }],
    [
      "producto de condolencias",
      { lines: [{ kind: "catalog", productId: "p-sym", variantId: "v", addOnIds: [], qty: 1 }] },
    ],
    ["solo get-well", { lines: [{ kind: "catalog", productId: "p-gw", variantId: "v", addOnIds: [], qty: 1 }] }],
    ["suscripción", { lines: [{ kind: "catalog", productId: "p-sub", variantId: "v", addOnIds: [], qty: 1 }] }],
    ["categoría suscripciones", { lines: [{ kind: "catalog", productId: "p-subcat", variantId: "v", addOnIds: [], qty: 1 }] }],
  ])("no califica: %s", (_n, over) => {
    expect(orderQualifiesForPrompt(makeOrder(over), NOW)).toBe(false);
  });
  it("un producto que ya no está en el catálogo cuenta como condolencias", () => {
    const lines: Order["lines"] = [
      { kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 },
      { kind: "catalog", productId: "retirado", variantId: "v", addOnIds: [], qty: 1 },
    ];
    expect(orderQualifiesForPrompt(makeOrder({ lines }), NOW)).toBe(false);
  });
  it("una línea a medida sin producto de catálogo sí califica", () => {
    const lines: Order["lines"] = [{ kind: "custom", title: "Ramo especial", priceCents: 5000, qty: 1 }];
    expect(orderQualifiesForPrompt(makeOrder({ lines }), NOW)).toBe(true);
  });
  it("entrega en una funeraria guardada no califica, aunque el producto sea normal", () => {
    addFuneralHome({
      name: "Capilla Inventada",
      address: { street1: "12 Calle Falsa", city: "Hempstead", state: "NY", zip: "11550", country: "US" },
    });
    const toHome = makeOrder({
      fulfillment: {
        method: "delivery",
        recipient: { name: "Familia Ruiz", phone: "5165559999" },
        address: { street1: "12 calle falsa.", city: "Hempstead", state: "NY", zip: "11550-1234", country: "US" },
        window: { date: "2026-03-18", slot: "morning" },
      },
    });
    expect(orderQualifiesForPrompt(toHome, NOW)).toBe(false);
    const elsewhere = makeOrder({
      fulfillment: {
        method: "delivery",
        recipient: { name: "Familia Ruiz", phone: "5165559999" },
        address: { street1: "99 Otra Calle", city: "Hempstead", state: "NY", zip: "11550", country: "US" },
        window: { date: "2026-03-18", slot: "morning" },
      },
    });
    expect(orderQualifiesForPrompt(elsewhere, NOW)).toBe(true);
  });
  it.each(["Funeraria San Inventado", "Inventado Funeral Home", "CAPILLA FUNERÁRIA"])(
    "destinatario que es una funeraria no califica: %s",
    (name) => {
      const o = makeOrder({
        fulfillment: { method: "pickup", recipient: { name, phone: "5165559999" }, window: { date: "2026-03-18", slot: "morning" } },
      });
      expect(orderQualifiesForPrompt(o, NOW)).toBe(false);
    },
  );
  it("get-well mezclado con otro producto sí califica", () => {
    const lines: Order["lines"] = [
      { kind: "catalog", productId: "p-gw", variantId: "v", addOnIds: [], qty: 1 },
      { kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 },
    ];
    expect(orderQualifiesForPrompt(makeOrder({ lines }), NOW)).toBe(true);
  });
  it("no califica si ya respondió", () => {
    getDb().prepare("INSERT INTO date_prompt_answers (order_id, answer, created_at) VALUES ('o1', 'dismiss', 'now')").run();
    expect(orderQualifiesForPrompt(makeOrder(), NOW)).toBe(false);
  });
  it("no califica con la variable apagada", () => {
    vi.stubEnv("DATE_REWARDS_ENABLED", "");
    expect(orderQualifiesForPrompt(makeOrder(), NOW)).toBe(false);
  });
});

describe("promptQuestion", () => {
  const withWindow = (date: string) =>
    makeOrder({
      fulfillment: { method: "pickup", recipient: { name: "Laura", phone: "5165559999" }, window: { date, slot: "morning" } },
    });

  it("pide la fecha con la entrega precargada", () => {
    expect(promptQuestion(withWindow("2026-03-18"), NOW)).toEqual({
      kind: "date",
      recipientName: "Laura",
      prefill: { month: 3, day: 18 },
    });
  });
  it("no precarga en temporada", () => {
    expect(promptQuestion(withWindow("2026-02-14"), NOW)).toEqual({ kind: "date", recipientName: "Laura", prefill: null });
  });
  it("no precarga en tienda", () => {
    const o = makeOrder({ fulfillment: { method: "in-store", recipient: { name: "Laura", phone: "" } } });
    expect(promptQuestion(o, NOW)).toEqual({ kind: "date", recipientName: "Laura", prefill: null });
  });
  it("no pregunta si el destinatario es el mismo comprador", () => {
    const o = makeOrder({
      fulfillment: {
        method: "pickup",
        recipient: { name: "Ana", phone: "+1 (516) 555-0100" },
        window: { date: "2026-03-18", slot: "morning" },
      },
    });
    expect(promptQuestion(o, NOW)).toBeNull();
  });
  it("sin teléfono del destinatario sí pregunta", () => {
    const o = makeOrder({ fulfillment: { method: "in-store", recipient: { name: "Laura", phone: "" } } });
    expect(promptQuestion(o, NOW)?.kind).toBe("date");
  });
  it("sin nombre de destinatario no pregunta", () => {
    const o = makeOrder({
      fulfillment: { method: "pickup", recipient: { name: " ", phone: "" }, window: { date: "2026-03-18", slot: "morning" } },
    });
    expect(promptQuestion(o, NOW)).toBeNull();
  });
  it("con fecha y sin gustos pide gustos", () => {
    addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18 });
    const d = findRecipientDate("c1", { name: "Laura" })!;
    const q = promptQuestion(makeOrder(), NOW);
    expect(q).toEqual({ kind: "likes", dateId: d.id, recipientName: "Laura", prefill: null });
  });
  it("evitar solo no cuenta como gustos", () => {
    addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18 });
    const d = findRecipientDate("c1", { name: "Laura" })!;
    setDatePreferences(d.id, { flowers: [], colors: [], avoid: ["lilies"] });
    const q = promptQuestion(makeOrder(), NOW);
    expect(q?.kind).toBe("likes");
  });
  it("con fecha y gustos no pregunta", () => {
    addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18 });
    const d = findRecipientDate("c1", { name: "Laura" })!;
    setDatePreferences(d.id, { flowers: ["roses"], colors: [], avoid: [] });
    expect(promptQuestion(makeOrder(), NOW)).toBeNull();
  });
});

describe("promptReward", () => {
  const order = () => makeOrder();

  it("promete el premio cuando este sello lo alcanza", async () => {
    lookupMock.mockResolvedValue(card({ at: 10, reward: "15%", remaining: 2 }));
    seedSync("o1", "pending");
    expect(await promptReward(order(), "fecha")).toEqual({ kind: "reward", reward: "15%" });
    expect(lookupMock.mock.calls[0][0]).toBe("+15165550100");
  });
  it("si el pedido ya se registró, promete solo el sello", async () => {
    lookupMock.mockResolvedValue(card({ at: 10, reward: "15%", remaining: 2 }));
    seedSync("o1", "done");
    expect(await promptReward(order(), "fecha")).toEqual({ kind: "stamp" });
  });
  it("falta uno sin pedido pendiente → premio", async () => {
    lookupMock.mockResolvedValue(card({ at: 10, reward: "15%", remaining: 1 }));
    expect(await promptReward(order(), "gustos")).toEqual({ kind: "reward", reward: "15%" });
  });
  it("tarjeta sin next → sello", async () => {
    lookupMock.mockResolvedValue(card());
    expect(await promptReward(order(), "fecha")).toEqual({ kind: "stamp" });
  });
  it("tarjeta en camino con este pedido → sello", async () => {
    lookupMock.mockResolvedValue(null);
    seedSync("o1", "pending");
    expect(await promptReward(makeOrder({ loyaltyJoin: true }), "fecha")).toEqual({ kind: "stamp" });
  });
  it("sin tarjeta ni inscripción → nada", async () => {
    lookupMock.mockResolvedValue(null);
    expect(await promptReward(order(), "fecha")).toBeNull();
    seedSync("o1", "pending");
    expect(await promptReward(order(), "fecha")).toBeNull();
  });
  it("inscrito pero el pedido ya no está pendiente → nada", async () => {
    lookupMock.mockResolvedValue(null);
    seedSync("o1", "done");
    expect(await promptReward(makeOrder({ loyaltyJoin: true }), "fecha")).toBeNull();
  });
  it("cupo usado → nada", async () => {
    lookupMock.mockResolvedValue(card());
    seedBonus("fecha");
    expect(await promptReward(order(), "fecha")).toBeNull();
    expect(await promptReward(order(), "gustos")).toEqual({ kind: "stamp" });
  });
  it("programa apagado → nada", async () => {
    vi.stubEnv("LOYALTY_API_URL", "");
    expect(await promptReward(order(), "fecha")).toBeNull();
  });
  it("programa que no responde → nada", async () => {
    lookupMock.mockRejectedValue(new Error("boom"));
    expect(await promptReward(order(), "fecha")).toBeNull();
  });
  it("programa que se cuelga → nada dentro del plazo", async () => {
    lookupMock.mockReturnValue(new Promise(() => {}));
    const t0 = Date.now();
    expect(await promptReward(order(), "fecha", { timeoutMs: 50 })).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
