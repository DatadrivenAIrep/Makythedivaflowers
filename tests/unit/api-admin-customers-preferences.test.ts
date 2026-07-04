import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { POST, DELETE } from "@/app/api/admin/customers/[id]/preferences/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
}

const ctx = { params: Promise.resolve({ id: "c1" }) };
const req = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body) });

describe("POST /preferences", () => {
  it("adds a normalized value and returns the map", async () => {
    seed();
    const res = await POST(req({ kind: "dislike", value: "  Lirios " }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).preferences.dislike).toEqual(["lirios"]);
  });

  it("400s on whitespace-only value and invalid kind", async () => {
    seed();
    expect((await POST(req({ kind: "dislike", value: "   " }), ctx)).status).toBe(400);
    expect((await POST(req({ kind: "bogus", value: "rosas" }), ctx)).status).toBe(400);
  });

  it("404s on unknown customer", async () => {
    const res = await POST(req({ kind: "dislike", value: "lirios" }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /preferences", () => {
  it("removes a value and returns the remaining map", async () => {
    seed();
    await POST(req({ kind: "favorite_flower", value: "peonías" }), ctx);
    await POST(req({ kind: "favorite_flower", value: "rosas" }), ctx);
    const res = await DELETE(req({ kind: "favorite_flower", value: "peonías" }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).preferences.favorite_flower).toEqual(["rosas"]);
  });
});
