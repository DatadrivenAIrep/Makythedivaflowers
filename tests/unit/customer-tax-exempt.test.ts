import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getCustomerById, updateCustomer } from "@/lib/customer-storage";
import { PATCH } from "@/app/api/admin/customers/[id]/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function seed() {
  getDb().prepare(
    "INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES ('c1', 'Iglesia', '5165550100', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
  ).run();
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = (id: string): any => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown) => PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }), ctx("c1"));

describe("customer tax exemption", () => {
  it("defaults to not exempt", () => {
    seed();
    expect(getCustomerById("c1")?.taxExemption).toEqual({ exempt: false, cert: null, expires: null });
  });

  it("updateCustomer stores a trimmed exemption", () => {
    seed();
    const c = updateCustomer("c1", { taxExemption: { exempt: true, cert: " 11-222 ", expires: "2027-12-31" } });
    expect(c?.taxExemption).toEqual({ exempt: true, cert: "11-222", expires: "2027-12-31" });
  });

  it("PATCH round-trips and clears an empty expiry", async () => {
    seed();
    const res = await patch({ taxExemption: { exempt: true, cert: "11-222", expires: "" } });
    expect(res.status).toBe(200);
    expect((await res.json()).customer.taxExemption).toEqual({ exempt: true, cert: "11-222", expires: null });
  });

  it("PATCH 400s when exempt without a certificate", async () => {
    seed();
    const res = await patch({ taxExemption: { exempt: true, cert: "" } });
    expect(res.status).toBe(400);
    expect(getCustomerById("c1")?.taxExemption.exempt).toBe(false);
  });

  it("turning it off keeps the cert on record", async () => {
    seed();
    await patch({ taxExemption: { exempt: true, cert: "11-222" } });
    await patch({ taxExemption: { exempt: false, cert: "11-222" } });
    expect(getCustomerById("c1")?.taxExemption).toEqual({ exempt: false, cert: "11-222", expires: null });
  });
});
