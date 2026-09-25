// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { enableForOrder } from "@/lib/digital-cards";
import { qrPng, qrSvgDataUri } from "@/lib/digital-card-qr";
import { GET } from "@/app/api/admin/orders/[id]/digital-card/qr/route";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("qr helpers", () => {
  it("qrSvgDataUri returns a deterministic svg data uri", async () => {
    const a = await qrSvgDataUri("https://makythedivaflowers.com/c/Ab3dE5fG");
    expect(a.startsWith("data:image/svg+xml;base64,")).toBe(true);
    const svg = Buffer.from(a.split(",")[1], "base64").toString("utf8");
    expect(svg).toContain("<svg");
    expect(await qrSvgDataUri("https://makythedivaflowers.com/c/Ab3dE5fG")).toBe(a);
    expect(await qrSvgDataUri("https://makythedivaflowers.com/c/Zz9yX8wV")).not.toBe(a);
  });
  it("qrPng returns a 1024px png", async () => {
    const png = await qrPng("https://makythedivaflowers.com/c/Ab3dE5fG");
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
    expect(png.readUInt32BE(16)).toBe(1024); // IHDR width
  });
});

describe("GET /api/admin/orders/[id]/digital-card/qr", () => {
  beforeEach(() => {
    vi.stubEnv("SQLITE_FILE", ":memory:");
    vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
    runMigrations();
    getDb().prepare(
      `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
         fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
         tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
       VALUES ('o1', 'es', 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
         'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
    ).run();
  });
  afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

  const params = { params: Promise.resolve({ id: "o1" }) };
  const authed = () => new Request("http://x", { headers: { cookie: `intake_session=${signSession()}` } });

  it("downloads a png once enabled", async () => {
    enableForOrder("o1", () => "Ab3dE5fG");
    const res = await GET(authed(), params);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="tarjeta-o1.png"');
    const buf = Buffer.from(await res.arrayBuffer());
    expect([...buf.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  });
  it("404 when not enabled", async () => {
    expect((await GET(authed(), params)).status).toBe(404);
  });
  it("401 without session", async () => {
    expect((await GET(new Request("http://x"), params)).status).toBe(401);
  });
});
