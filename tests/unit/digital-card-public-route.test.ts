// @vitest-environment node
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { enableForOrder, setTargetUrl } from "@/lib/digital-cards";
import { GET } from "@/app/c/[code]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed(id: string, locale: "es" | "en") {
  getDb().prepare(
    `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
       fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
       tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
     VALUES (?, ?, 'walk-in', 'Ana', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
       'pending', 'pending', '2026-06-01T08:00:00Z', '2026-06-01T08:00:00Z')`,
  ).run(id, locale);
}
const get = (code: string) => GET(new Request(`http://x/c/${code}`), { params: Promise.resolve({ code }) });
const URL_OK = "https://tarjetas.makythedivaflowers.com/i/raymond-50-k3x9";

it("302s to the card when a url is set", async () => {
  seed("o1", "es");
  enableForOrder("o1", () => "Ab3dE5fG");
  setTargetUrl("o1", URL_OK);
  const res = await get("Ab3dE5fG");
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(URL_OK);
  expect(res.headers.get("cache-control")).toBe("no-store");
});

it("shows the Spanish preparing page without a url", async () => {
  seed("o1", "es");
  enableForOrder("o1", () => "Ab3dE5fG");
  const res = await get("Ab3dE5fG");
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("content-type")).toContain("text/html");
  const html = await res.text();
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).toContain('lang="es"');
  expect(html).toContain("se está terminando de preparar");
});

it("uses English for an English order", async () => {
  seed("o2", "en");
  enableForOrder("o2", () => "Zz9yX8wV");
  const html = await (await get("Zz9yX8wV")).text();
  expect(html).toContain('lang="en"');
  expect(html).toContain("is being finished");
});

it("treats a stored url on a no-longer-allowed host as not ready", async () => {
  seed("o1", "es");
  enableForOrder("o1", () => "Ab3dE5fG");
  setTargetUrl("o1", "https://evil.example.com/x"); // bypasses the schema on purpose
  expect((await get("Ab3dE5fG")).status).toBe(200);
});

it("404s unknown and malformed codes", async () => {
  for (const code of ["Nope1234", "short", "has space!", "../../etc"]) {
    const res = await get(code);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain('<meta name="robots" content="noindex">');
  }
});
