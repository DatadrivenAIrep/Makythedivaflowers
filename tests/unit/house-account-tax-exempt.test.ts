import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { signSession } from "@/lib/admin-auth";
import { createAccount, getAccount, updateAccount } from "@/lib/house-account-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-test-secret-test-secret");
  runMigrations();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function req(method: string, body: unknown) {
  return new Request("http://x/api/admin/accounts", {
    method,
    headers: { "content-type": "application/json", cookie: `intake_session=${signSession()}` },
    body: JSON.stringify(body),
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const params = (p: Record<string, string>): any => ({ params: Promise.resolve(p) });

describe("house account tax exemption", () => {
  it("createAccount defaults to not exempt and accepts one", () => {
    expect(createAccount({ name: "Hotel" }, "2026-10-01").taxExemption).toEqual({ exempt: false, cert: null, expires: null });
    const a = createAccount({ name: "Iglesia", taxExemption: { exempt: true, cert: " 99 " } }, "2026-10-01");
    expect(a.taxExemption).toEqual({ exempt: true, cert: "99", expires: null });
  });

  it("updateAccount changes it and an unrelated patch keeps it", () => {
    const a = createAccount({ name: "Iglesia", taxExemption: { exempt: true, cert: "99" } }, "2026-10-01");
    updateAccount(a.id, { termsDays: 30 }, "2026-10-01");
    expect(getAccount(a.id)?.taxExemption.cert).toBe("99");
    updateAccount(a.id, { taxExemption: { exempt: true, cert: "100", expires: "2027-01-31" } }, "2026-10-01");
    expect(getAccount(a.id)?.taxExemption).toEqual({ exempt: true, cert: "100", expires: "2027-01-31" });
  });

  it("API: POST 400s without a cert; PATCH stores it", async () => {
    const { POST } = await import("@/app/api/admin/accounts/route");
    expect((await POST(req("POST", { name: "X", taxExemption: { exempt: true, cert: "" } }))).status).toBe(400);
    const created = await POST(req("POST", { name: "Escuela", taxExemption: { exempt: true, cert: "77" } }));
    expect(created.status).toBe(201);
    const { account } = await created.json();
    expect(account.taxExemption.cert).toBe("77");
    const { PATCH } = await import("@/app/api/admin/accounts/[id]/route");
    const r = await PATCH(req("PATCH", { taxExemption: { exempt: false, cert: "77" } }), params({ id: account.id }));
    expect(r.status).toBe(200);
    expect((await r.json()).account.taxExemption.exempt).toBe(false);
  });
});
