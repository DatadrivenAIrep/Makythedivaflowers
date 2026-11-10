import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { saveOrder } from "@/lib/order-storage";
import { listDatesFor, addImportantDate } from "@/lib/customer-dates-storage";
import { getDatePreferences } from "@/lib/date-preferences-storage";
import { markSmsStopped } from "@/lib/promo-consent";
import type { Order } from "@/types/order";
import type { Product } from "@/types/product";

const lookupCustomer = vi.fn();
vi.mock("@/lib/loyalty-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/loyalty-client")>();
  return { ...actual, lookupCustomer: (...a: unknown[]) => lookupCustomer(...a) };
});
vi.mock("@/lib/product-prices", () => ({
  getPricedProducts: () => [
    { id: "p-normal", category: "arrangements", occasions: ["birthday"], variants: [] } as unknown as Product,
  ],
}));

import { GET, POST } from "@/app/api/orders/[id]/date-prompt/route";

const BUYER = "5165550100";

function makeOrder(over: Partial<Order> = {}): Order {
  const now = new Date().toISOString();
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
    createdAt: now,
    updatedAt: now,
    ...over,
  } as Order;
}

async function seed(over: Partial<Order> = {}) {
  const at = new Date().toISOString();
  getDb()
    .prepare("INSERT OR IGNORE INTO customers (id, name, phone, first_seen_at, last_seen_at) VALUES ('c1', 'Ana', ?, ?, ?)")
    .run(BUYER, at, at);
  await saveOrder(makeOrder(over));
}

const ctx = (id = "o1") => ({ params: Promise.resolve({ id }) });
function post(body: unknown, ip = "1.1.1.1", id = "o1") {
  return POST(
    new Request("http://t/api/orders/" + id + "/date-prompt", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}
function get(ip = "1.1.1.1", id = "o1") {
  return GET(new Request("http://t/api/orders/" + id + "/date-prompt", { headers: { "x-forwarded-for": ip } }), ctx(id));
}
const DATE = { action: "date", kind: "birthday", month: 3, day: 18, smsOptIn: false };
const dates = () => listDatesFor("c1");
const bonusRows = () => getDb().prepare("SELECT slot, status, attempts FROM loyalty_bonus").all() as Array<{
  slot: string;
  status: string;
  attempts: number;
}>;

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-date-prompt-" + process.pid + ".json");
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.example/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "k");
  vi.stubEnv("DATE_REWARDS_ENABLED", "1");
  runMigrations();
  __resetRateLimitForTests();
  lookupCustomer.mockReset().mockResolvedValue({ id: 77, cardUrl: "x", rewards: { available: [] } });
  await seed();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("GET /api/orders/:id/date-prompt", () => {
  it("devuelve la pregunta, el premio y el permiso", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.question).toMatchObject({ kind: "date", recipientName: "Laura" });
    expect(j.permission).toBe("none");
    expect(j).toHaveProperty("reward");
  });
  it("404 si el pedido no existe", async () => {
    expect((await get("1.1.1.1", "nope")).status).toBe(404);
  });
});

describe("POST /api/orders/:id/date-prompt", () => {
  it("404 si el pedido no califica", async () => {
    await seed({ id: "o2", paymentStatus: "pending" });
    const res = await post(DATE, "1.1.1.1", "o2");
    expect(res.status).toBe(404);
    expect(dates()).toHaveLength(0);
  });

  it("guarda la fecha como del cliente con el nombre del destinatario", async () => {
    const res = await post(DATE);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, permission: "none", stamp: true });
    const [d] = dates();
    expect(d).toMatchObject({ source: "customer", label: "Laura", month: 3, day: 18, kind: "birthday" });
    expect(bonusRows().map((r) => r.slot)).toEqual(["fecha"]);
  });

  it("una sola respuesta por pedido", async () => {
    expect((await post(DATE)).status).toBe(200);
    const again = await post({ ...DATE, month: 4 });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "already_answered" });
    expect(dates()).toHaveLength(1);
  });

  it("dos POST simultáneos dejan una sola fecha", async () => {
    const [a, b] = await Promise.all([post(DATE), post(DATE)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(dates()).toHaveLength(1);
    expect(bonusRows().length).toBeLessThanOrEqual(1);
  });

  it("30 de febrero → 400 y se puede reintentar", async () => {
    const bad = await post({ ...DATE, month: 2, day: 30 });
    expect(bad.status).toBe(400);
    expect(dates()).toHaveLength(0);
    const ok = await post({ ...DATE, month: 2, day: 29 });
    expect(ok.status).toBe(200);
    expect(dates()).toHaveLength(1);
  });

  it("cuerpo inválido → 400", async () => {
    expect((await post({ action: "nope" })).status).toBe(400);
    expect((await post({ action: "likes", flowers: ["not-a-flower"], colors: [], avoid: [], smsOptIn: false })).status).toBe(400);
  });

  it("la casilla marcada da permiso y deja constancia", async () => {
    const res = await post({ ...DATE, smsOptIn: true });
    expect((await res.json()).permission).toBe("granted");
    const tag = getDb().prepare("SELECT 1 FROM customer_tags WHERE customer_id = 'c1' AND tag = 'sms-marketing'").get();
    expect(tag).toBeTruthy();
    const log = getDb().prepare("SELECT action, source, ip FROM marketing_consent_log").all();
    expect(log).toEqual([{ action: "grant", source: "date_prompt", ip: "1.1.1.1" }]);
  });

  it("con STOP la casilla no da permiso", async () => {
    markSmsStopped("c1");
    const res = await post({ ...DATE, smsOptIn: true });
    expect((await res.json()).permission).toBe("stopped");
    expect(getDb().prepare("SELECT 1 FROM customer_tags WHERE tag = 'sms-marketing'").get()).toBeUndefined();
  });

  it("gustos: guarda y reclama el sello 'gustos'", async () => {
    const d = addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18, source: "customer" });
    const res = await post({ action: "likes", flowers: ["roses"], colors: ["pink"], avoid: [], smsOptIn: false });
    expect(res.status).toBe(200);
    expect((await res.json()).stamp).toBe(true);
    expect(getDatePreferences(d[0].id).flowers).toEqual(["roses"]);
    expect(bonusRows().map((r) => r.slot)).toEqual(["gustos"]);
  });

  it("solo evitar no reclama sello", async () => {
    addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18, source: "customer" });
    const res = await post({ action: "likes", flowers: [], colors: [], avoid: ["lilies"], smsOptIn: false });
    expect(res.status).toBe(200);
    expect((await res.json()).stamp).toBe(false);
    expect(bonusRows()).toHaveLength(0);
  });

  it("acción que no corresponde a la pregunta → 409 stale_question sin consumir la respuesta", async () => {
    const res = await post({ action: "likes", flowers: ["roses"], colors: [], avoid: [], smsOptIn: false });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "stale_question" });
    expect((await post(DATE)).status).toBe(200);
  });

  it("No, gracias cierra la pregunta", async () => {
    const res = await post({ action: "dismiss" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, stamp: false });
    expect((await get()).status).toBe(404);
    expect(dates()).toHaveLength(0);
  });

  it("con el programa caído guarda y responde", async () => {
    lookupCustomer.mockRejectedValue(new Error("down"));
    const res = await post(DATE);
    expect(res.status).toBe(200);
    expect(dates()).toHaveLength(1);
    await vi.waitFor(() => expect(bonusRows()[0]?.attempts).toBe(1));
    expect(bonusRows()[0]).toMatchObject({ slot: "fecha", status: "pending", attempts: 1 });
  });

  it("límite por IP: la llamada 31 recibe 429", async () => {
    for (let i = 0; i < 30; i++) expect((await get("9.9.9.9", "nope")).status).toBe(404);
    expect((await get("9.9.9.9", "nope")).status).toBe(429);
    expect((await post({ action: "dismiss" }, "9.9.9.9")).status).toBe(429);
  });
});
