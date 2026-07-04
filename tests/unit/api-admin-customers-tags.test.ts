import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST, DELETE } from "@/app/api/admin/customers/[id]/tags/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
}

const ctx = { params: Promise.resolve({ id: "c1" }) };
const req = (tag: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify({ tag }) });

describe("POST /tags", () => {
  it("adds a normalized tag idempotently", async () => {
    seed();
    const r1 = await POST(req("  Boda  Junio "), ctx);
    expect(r1.status).toBe(200);
    expect((await r1.json()).tags).toEqual(["boda junio"]);
    const r2 = await POST(req("boda junio"), ctx);
    expect((await r2.json()).tags).toEqual(["boda junio"]);
  });

  it("400s on empty/invalid tag", async () => {
    seed();
    expect((await POST(req("   "), ctx)).status).toBe(400);
    expect((await POST(req(42), ctx)).status).toBe(400);
  });

  it("404s on unknown customer", async () => {
    const res = await POST(req("boda"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /tags", () => {
  it("removes a tag and returns the remaining list", async () => {
    seed();
    await POST(req("boda"), ctx);
    await POST(req("vip"), ctx);
    const res = await DELETE(req("boda"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).tags).toEqual(["vip"]);
  });
});
