import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST, DELETE } from "@/app/api/admin/customers/[id]/dates/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
}

const ctx = { params: Promise.resolve({ id: "c1" }) };
const post = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("POST /dates", () => {
  it("adds a date and returns the updated list", async () => {
    seed();
    const res = await POST(post({ kind: "birthday", label: "esposa María", month: 3, day: 15 }), ctx);
    expect(res.status).toBe(200);
    const { dates } = await res.json();
    expect(dates).toHaveLength(1);
    expect(dates[0].kind).toBe("birthday");
    expect(dates[0].label).toBe("esposa María");
    expect(typeof dates[0].next.daysUntil).toBe("number");
  });

  it("400s on impossible month/day (Apr 31) and on zod-invalid bodies", async () => {
    seed();
    expect((await POST(post({ kind: "birthday", month: 4, day: 31 }), ctx)).status).toBe(400);
    expect((await POST(post({ kind: "birthday", month: 13, day: 1 }), ctx)).status).toBe(400);
    expect((await POST(post({ kind: "bogus", month: 3, day: 15 }), ctx)).status).toBe(400);
  });

  it("404s on unknown customer", async () => {
    const res = await POST(post({ kind: "birthday", month: 3, day: 15 }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /dates", () => {
  it("removes by id; unknown id is an idempotent no-op", async () => {
    seed();
    const created = await (await POST(post({ kind: "custom", month: 6, day: 1 }), ctx)).json();
    const id = created.dates[0].id;

    const miss = await DELETE(post({ id: "nope" }), ctx);
    expect(miss.status).toBe(200);
    expect((await miss.json()).dates).toHaveLength(1);

    const hit = await DELETE(post({ id }), ctx);
    expect((await hit.json()).dates).toEqual([]);
  });
});
