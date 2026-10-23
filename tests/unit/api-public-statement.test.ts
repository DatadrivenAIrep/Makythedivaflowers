import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount } from "@/lib/house-account-storage";
import { GET } from "@/app/s/[code]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seedStatement(accountId: string, status = "open", settled = 0) {
  getDb().prepare(
    `INSERT INTO house_account_statements (id, account_id, number, code, period_start, period_end, issued_at, due_date,
       opening_cents, charges_cents, credits_cents, payments_cents, closing_cents, settled_cents, status, lines_json, created_at)
     VALUES ('hst_1', ?, 'ST-1001', 'AbCdEfGh', '2026-09-01', '2026-09-30', '2026-10-01T13:00:00Z', '2026-10-16', 0, 7000, 0, 0, 7000, ?, ?, '[]', '2026-10-01T13:00:00Z')`,
  ).run(accountId, settled, status);
}
const get = (code: string, qs = "") => GET(new Request(`http://x/s/${code}${qs}`), { params: Promise.resolve({ code }) });

describe("GET /s/[code]", () => {
  it("404 for a bad or unknown code", async () => {
    expect((await get("nope")).status).toBe(404);
    expect((await get("AbCdEfGh")).status).toBe(404);
  });
  it("200 with the document, no-store and noindex", async () => {
    const a = createAccount({ name: "Hotel", locale: "es" });
    seedStatement(a.id);
    const res = await get("AbCdEfGh");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const html = await res.text();
    expect(html).toContain("ST-1001");
    expect(html).toContain('action="/s/AbCdEfGh/pay"');
  });
  it("paid shows no pay form; ?paid=1 on an open one shows the note", async () => {
    const a = createAccount({ name: "Hotel" });
    seedStatement(a.id, "paid", 7000);
    expect(await (await get("AbCdEfGh")).text()).not.toContain("/pay");
    closeDb(); runMigrations();
    const b = createAccount({ name: "Hotel" });
    seedStatement(b.id);
    expect(await (await get("AbCdEfGh", "?paid=1")).text()).toContain("Payment received");
  });
  it("410 for a void statement", async () => {
    const a = createAccount({ name: "Hotel", locale: "en" });
    seedStatement(a.id, "void");
    const res = await get("AbCdEfGh");
    expect(res.status).toBe(410);
    expect(await res.text()).toContain("no longer valid");
  });
});
