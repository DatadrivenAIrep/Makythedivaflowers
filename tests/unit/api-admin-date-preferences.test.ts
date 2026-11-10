import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import { getDatePreferences } from "@/lib/date-preferences-storage";
import { PUT } from "@/app/api/admin/customers/[id]/dates/[dateId]/preferences/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("DATE_REWARDS_ENABLED", "1");
  runMigrations();
  getDb().prepare(
    `INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at)
     VALUES ('c1', 'Ana', '5551', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
  ).run();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const put = (body: unknown, id = "c1", dateId = "x") =>
  PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id, dateId }),
  });
const mk = () => addImportantDate("c1", { kind: "birthday", label: "María", month: 3, day: 15 })[0].id;

describe("PUT preferences", () => {
  it("el personal edita gustos sin sello", async () => {
    const id = mk();
    const res = await put({ flowers: ["roses"], colors: ["pink"], avoid: ["strong_scent"] }, "c1", id);
    expect(res.status).toBe(200);
    expect(getDatePreferences(id)).toEqual({ flowers: ["roses"], colors: ["pink"], avoid: ["strong_scent"] });
    expect(getDb().prepare("SELECT COUNT(*) n FROM loyalty_bonus").get()).toEqual({ n: 0 });
  });

  it("404 con la variable apagada, cliente o fecha ajena", async () => {
    const id = mk();
    expect((await put({ flowers: [], colors: [], avoid: [] }, "nope", id)).status).toBe(404);
    expect((await put({ flowers: [], colors: [], avoid: [] }, "c1", "nope")).status).toBe(404);
    vi.stubEnv("DATE_REWARDS_ENABLED", "");
    expect((await put({ flowers: ["roses"], colors: [], avoid: [] }, "c1", id)).status).toBe(404);
    expect(getDatePreferences(id).flowers).toEqual([]);
  });

  it("400 con cuerpo inválido", async () => {
    const id = mk();
    expect((await put({ flowers: "x" }, "c1", id)).status).toBe(400);
  });
});
