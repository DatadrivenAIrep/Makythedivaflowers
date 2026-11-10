import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { __resetRateLimitForTests } from "@/lib/rate-limit";
import { saveOrder } from "@/lib/order-storage";
import { signCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth";
import { addImportantDate, listDatesFor } from "@/lib/customer-dates-storage";
import { getDatePreferences, setDatePreferences } from "@/lib/date-preferences-storage";
import { markSmsStopped } from "@/lib/promo-consent";
import { accountDatesView } from "@/lib/account-dates";
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
    { id: "p-funeral", category: "sympathy", occasions: ["sympathy"], variants: [] } as unknown as Product,
  ],
}));

import { GET, POST } from "@/app/api/account/dates/route";
import { DELETE, PUT } from "@/app/api/account/dates/[id]/route";
import { POST as SMS } from "@/app/api/account/sms-permission/route";

const SECRET = "c".repeat(48);
const BUYER = "5165550100";

function seedCustomer(id: string, phone: string) {
  const at = new Date().toISOString();
  getDb()
    .prepare("INSERT OR IGNORE INTO customers (id, name, phone, first_seen_at, last_seen_at) VALUES (?, 'Ana', ?, ?, ?)")
    .run(id, phone, at, at);
}

function makeOrder(id: string, day: string, over: Partial<Order> = {}): Order {
  const now = new Date().toISOString();
  return {
    id,
    source: "web",
    locale: "es",
    customerId: "c1",
    lines: [{ kind: "catalog", productId: "p-normal", variantId: "v", addOnIds: [], qty: 1 }],
    fulfillment: {
      method: "pickup",
      recipient: { name: "Laura", phone: "5165559999" },
      window: { date: day, slot: "morning" },
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

function req(method: string, url: string, body?: unknown, who: string | null = "c1") {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" };
  if (who) headers.cookie = `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(signCustomerSession(who))}`;
  return new Request(`http://t${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const add = (over: Record<string, unknown> = {}, who: string | null = "c1") =>
  POST(req("POST", "/api/account/dates", { action: "add", kind: "birthday", name: "Laura", month: 3, day: 18, ...over }, who));
const dates = (id = "c1") => listDatesFor(id);
const bonusRows = () => getDb().prepare("SELECT slot FROM loyalty_bonus").all() as Array<{ slot: string }>;

beforeEach(async () => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-account-dates-" + process.pid + ".json");
  vi.stubEnv("INTAKE_SESSION_SECRET", SECRET);
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.example/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "k");
  vi.stubEnv("DATE_REWARDS_ENABLED", "1");
  runMigrations();
  __resetRateLimitForTests();
  lookupCustomer.mockReset().mockResolvedValue({ id: 77, cardUrl: "x", rewards: { available: [] } });
  seedCustomer("c1", BUYER);
  seedCustomer("c2", "5165550200");
  await saveOrder(makeOrder("o1", "2026-03-18"));
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("/api/account/dates", () => {
  it("401 sin sesión", async () => {
    expect((await GET(req("GET", "/api/account/dates", undefined, null))).status).toBe(401);
    expect((await add({}, null)).status).toBe(401);
    expect((await DELETE(req("DELETE", "/x", undefined, null), ctx("d"))).status).toBe(401);
    expect((await SMS(req("POST", "/x", { grant: true }, null))).status).toBe(401);
  });

  it("404 con la variable apagada", async () => {
    vi.stubEnv("DATE_REWARDS_ENABLED", "");
    expect((await GET(req("GET", "/api/account/dates"))).status).toBe(404);
    expect((await add()).status).toBe(404);
    expect(dates()).toHaveLength(0);
  });

  it("agregar guarda como del cliente y reclama el cupo fecha", async () => {
    const res = await add();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stamp: true });
    expect(dates()[0]).toMatchObject({ source: "customer", label: "Laura", month: 3, day: 18, kind: "birthday" });
    expect(bonusRows()).toEqual([{ slot: "fecha" }]);
    const view = await (await GET(req("GET", "/api/account/dates"))).json();
    expect(view.dates).toHaveLength(1);
    expect(view.permission).toBe("none");
  });

  it("copia los gustos de la misma persona a la fecha nueva", async () => {
    const [first] = addImportantDate("c1", { kind: "anniversary", label: "laura", month: 6, day: 1, source: "customer" });
    setDatePreferences(first.id, { flowers: ["roses"], colors: [], avoid: ["lilies"] });
    await add();
    const created = dates().find((d) => d.kind === "birthday")!;
    expect(getDatePreferences(created.id)).toEqual({ flowers: ["roses"], colors: [], avoid: ["lilies"] });
  });

  it("la fecha 13 da 409 too_many_dates", async () => {
    for (let i = 0; i < 12; i++) {
      expect((await add({ name: "Laura", month: 1 + (i % 12), day: 5 })).status).toBe(200);
    }
    const res = await add({ name: "Otra" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "too_many_dates" });
    expect(dates()).toHaveLength(12);
  });

  it("las fechas del personal también cuentan para el tope", async () => {
    for (let i = 0; i < 12; i++) addImportantDate("c1", { kind: "birthday", label: "X", month: 1, day: 1 + i });
    expect((await add()).status).toBe(409);
  });

  it("nombre con enlace o de 41 letras, o fecha imposible → 400", async () => {
    expect((await add({ name: "http://x.co" })).status).toBe(400);
    expect((await add({ name: "a".repeat(41) })).status).toBe(400);
    expect((await add({ name: "😀" })).status).toBe(400);
    expect((await add({ name: "   " })).status).toBe(400);
    expect((await add({ month: 2, day: 30 })).status).toBe(400);
    expect((await add({ month: 13 })).status).toBe(400);
    expect(dates()).toHaveLength(0);
    expect((await add({ name: "María José", month: 2, day: 29 })).status).toBe(200);
  });

  it("no borra fechas de otro cliente", async () => {
    const [mine] = addImportantDate("c2", { kind: "birthday", label: "Rosa", month: 5, day: 5, source: "customer" });
    const res = await DELETE(req("DELETE", "/x"), ctx(mine.id));
    expect(res.status).toBe(404);
    expect(dates("c2")).toHaveLength(1);
  });

  it("borra la fecha propia y sus gustos al instante", async () => {
    const [d] = addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18, source: "customer" });
    setDatePreferences(d.id, { flowers: ["roses"], colors: [], avoid: [] });
    expect((await DELETE(req("DELETE", "/x"), ctx(d.id))).status).toBe(200);
    expect(dates()).toHaveLength(0);
    expect(getDatePreferences(d.id).flowers).toEqual([]);
  });

  it("borrar y volver a crear no da otro sello", async () => {
    expect((await (await add()).json()).stamp).toBe(true);
    await DELETE(req("DELETE", "/x"), ctx(dates()[0].id));
    expect((await (await add()).json()).stamp).toBe(false);
    expect(bonusRows()).toHaveLength(1);
  });

  it("los gustos con flor reclaman gustos; solo evitar, no", async () => {
    const [d] = addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18, source: "customer" });
    const onlyAvoid = await PUT(req("PUT", "/x", { flowers: [], colors: [], avoid: ["lilies"] }), ctx(d.id));
    expect((await onlyAvoid.json()).stamp).toBe(false);
    expect(bonusRows()).toHaveLength(0);
    const withFlower = await PUT(req("PUT", "/x", { flowers: ["roses"], colors: [], avoid: [] }), ctx(d.id));
    expect(withFlower.status).toBe(200);
    expect((await withFlower.json()).stamp).toBe(true);
    expect(getDatePreferences(d.id).flowers).toEqual(["roses"]);
    expect(bonusRows()).toEqual([{ slot: "gustos" }]);
  });

  it("PUT sobre la fecha de otro cliente → 404 sin cambios", async () => {
    const [theirs] = addImportantDate("c2", { kind: "birthday", label: "Rosa", month: 5, day: 5, source: "customer" });
    const res = await PUT(req("PUT", "/x", { flowers: ["roses"], colors: [], avoid: [] }), ctx(theirs.id));
    expect(res.status).toBe(404);
    expect(getDatePreferences(theirs.id).flowers).toEqual([]);
    expect(bonusRows()).toHaveLength(0);
  });

  it("PUT con códigos inventados → 400", async () => {
    const [d] = addImportantDate("c1", { kind: "birthday", label: "Laura", month: 3, day: 18, source: "customer" });
    expect((await PUT(req("PUT", "/x", { flowers: ["nope"], colors: [], avoid: [] }), ctx(d.id))).status).toBe(400);
  });

  it("descartar una sugerencia la quita de la lista", async () => {
    await saveOrder(makeOrder("o2", "2025-09-10"));
    await saveOrder(makeOrder("o3", "2026-09-12"));
    const before = accountDatesView("c1").suggestions;
    expect(before).toHaveLength(1);
    const res = await POST(req("POST", "/api/account/dates", { action: "dismiss_suggestion", key: before[0].key }));
    expect(res.status).toBe(200);
    expect(accountDatesView("c1").suggestions).toHaveLength(0);
  });

  it("las sugerencias no incluyen destinatarios de condolencias", async () => {
    // Laura: two years around Sep 10 → suggested. Rosa: same pattern, but her orders were funeral ones.
    await saveOrder(makeOrder("o2", "2025-09-10"));
    await saveOrder(makeOrder("o3", "2026-09-12"));
    const rosa = { name: "Rosa", phone: "5165558888" };
    const forRosa = (id: string, day: string, over: Partial<Order>) =>
      makeOrder(id, day, {
        ...over,
        fulfillment: { method: "pickup", recipient: rosa, window: { date: day, slot: "morning" } },
      });
    await saveOrder(forRosa("f1", "2025-10-01", { funeral: true }));
    await saveOrder(
      forRosa("f2", "2026-10-02", { lines: [{ kind: "catalog", productId: "p-funeral", variantId: "v", addOnIds: [], qty: 1 }] }),
    );
    const names = accountDatesView("c1").suggestions.map((s) => s.recipientName);
    expect(names).toEqual(["Laura"]);
  });

  it("un producto que ya no está en el catálogo cuenta como condolencias", async () => {
    await saveOrder(makeOrder("o2", "2025-09-10", { lines: [{ kind: "catalog", productId: "gone", variantId: "v", addOnIds: [], qty: 1 }] }));
    await saveOrder(makeOrder("o3", "2026-09-12"));
    expect(accountDatesView("c1").suggestions).toHaveLength(0);
  });
});

describe("/api/account/sms-permission", () => {
  const tag = () => getDb().prepare("SELECT 1 FROM customer_tags WHERE customer_id = 'c1' AND tag = 'sms-marketing'").get();

  it("dar permiso deja constancia y quitarlo también", async () => {
    const on = await SMS(req("POST", "/x", { grant: true }));
    expect(on.status).toBe(200);
    expect(await on.json()).toEqual({ permission: "granted" });
    expect(tag()).toBeTruthy();
    const off = await SMS(req("POST", "/x", { grant: false }));
    expect(await off.json()).toEqual({ permission: "none" });
    expect(tag()).toBeUndefined();
    expect(getDb().prepare("SELECT action, source, ip FROM marketing_consent_log ORDER BY created_at").all()).toEqual([
      { action: "grant", source: "account", ip: "1.1.1.1" },
      { action: "revoke", source: "account", ip: "1.1.1.1" },
    ]);
  });

  it("con STOP responde 409 y no da permiso", async () => {
    markSmsStopped("c1");
    const res = await SMS(req("POST", "/x", { grant: true }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ permission: "stopped" });
    expect(tag()).toBeUndefined();
  });

  it("cuerpo inválido → 400", async () => {
    expect((await SMS(req("POST", "/x", { grant: "yes" }))).status).toBe(400);
  });
});
