// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { POST, PATCH } from "@/app/api/admin/orders/[id]/digital-card/route";
import { listOrderHistory } from "@/lib/order-history";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string) {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id);
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
function req(method: string, body?: unknown, auth = true) {
  return new Request("http://x", {
    method,
    headers: {
      ...(auth ? { cookie: `intake_session=${signSession()}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
const GOOD = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";

describe("POST /api/admin/orders/[id]/digital-card", () => {
  it("activates once and logs it once", async () => {
    seed("o1");
    const a = await (await POST(req("POST"), params("o1"))).json();
    expect(a.code).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(a.shortUrl).toBe(`https://makythedivaflowers.com/c/${a.code}`);
    expect(a.targetUrl).toBeNull();
    const b = await (await POST(req("POST"), params("o1"))).json();
    expect(b.code).toBe(a.code);
    const history = await listOrderHistory("o1");
    const entries = history.filter((c) => c.kind === "digital_card");
    expect(entries).toHaveLength(1);
    expect(entries[0].summary).toBe("Tarjeta digital activada");
  });
  it("401 without session", async () => {
    seed("o1");
    expect((await POST(req("POST", undefined, false), params("o1"))).status).toBe(401);
  });
  it("404 for an unknown order", async () => {
    expect((await POST(req("POST"), params("nope"))).status).toBe(404);
  });
});

describe("PATCH /api/admin/orders/[id]/digital-card", () => {
  it("stores an allowed url and logs it", async () => {
    seed("o1");
    await POST(req("POST"), params("o1"));
    const res = await PATCH(req("PATCH", { targetUrl: GOOD }), params("o1"));
    expect(res.status).toBe(200);
    expect((await res.json()).targetUrl).toBe(GOOD);
    const history = await listOrderHistory("o1");
    expect(history.some((c) => c.summary === "URL de tarjeta digital actualizada")).toBe(true);
  });
  it("stores a normalized, percent-encoded href for non-ASCII paths", async () => {
    seed("o1");
    await POST(req("POST"), params("o1"));
    const raw = "https://tarjetas.makythedivaflowers.com/i/josé";
    const res = await PATCH(req("PATCH", { targetUrl: raw }), params("o1"));
    expect(res.status).toBe(200);
    expect((await res.json()).targetUrl).toBe("https://tarjetas.makythedivaflowers.com/i/jos%C3%A9");
  });

  it("clears the url with null", async () => {
    seed("o1");
    await POST(req("POST"), params("o1"));
    await PATCH(req("PATCH", { targetUrl: GOOD }), params("o1"));
    expect((await (await PATCH(req("PATCH", { targetUrl: null }), params("o1"))).json()).targetUrl).toBeNull();
  });
  it("400 for a disallowed url or bad body", async () => {
    seed("o1");
    await POST(req("POST"), params("o1"));
    const bad = await PATCH(req("PATCH", { targetUrl: "https://evil.example.com/x" }), params("o1"));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("invalid_card_url");
    expect((await PATCH(req("PATCH", { nope: 1 }), params("o1"))).status).toBe(400);
  });
  it("404 when not enabled", async () => {
    seed("o1");
    expect((await PATCH(req("PATCH", { targetUrl: GOOD }), params("o1"))).status).toBe(404);
  });
  it("401 without session", async () => {
    seed("o1");
    expect((await PATCH(req("PATCH", { targetUrl: GOOD }, false), params("o1"))).status).toBe(401);
  });
});
