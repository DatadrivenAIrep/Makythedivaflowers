import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createPromo, getPromoByCode, listPromos } from "@/lib/promo";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

async function post(body: unknown) {
  const { POST } = await import("@/app/api/admin/promos/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function patch(id: string, body: unknown) {
  const { PATCH } = await import("@/app/api/admin/promos/[id]/route");
  return PATCH(
    new Request("http://t", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("GET /api/admin/promos", () => {
  it("lists promos with their redemption counts", async () => {
    createPromo({ code: "A", kind: "percent", value: 10 });
    const { GET } = await import("@/app/api/admin/promos/route");
    const data = await (await GET()).json();
    expect(data.promos).toHaveLength(1);
    expect(data.promos[0].code).toBe("A");
    expect(data.promos[0].redemptionCount).toBe(0);
  });
});

describe("POST /api/admin/promos", () => {
  it("creates a percent code", async () => {
    const res = await post({ code: "welcome10", kind: "percent", value: 10 });
    expect(res.status).toBe(200);
    expect(getPromoByCode("WELCOME10")?.value).toBe(10);
  });

  it("creates a fixed code with a minimum and a first-order limit", async () => {
    await post({
      code: "TWENTY",
      kind: "fixed",
      value: 2000,
      minSubtotalCents: 10000,
      firstOrderOnly: true,
    });
    const p = getPromoByCode("TWENTY")!;
    expect(p.kind).toBe("fixed");
    expect(p.minSubtotalCents).toBe(10000);
    expect(p.firstOrderOnly).toBe(true);
  });

  it("rejects a percentage over 100", async () => {
    const res = await post({ code: "BAD", kind: "percent", value: 150 });
    expect(res.status).toBe(400);
    expect(getPromoByCode("BAD")).toBeNull();
  });

  it("rejects a duplicate code with a clear error rather than a crash", async () => {
    await post({ code: "DUP", kind: "percent", value: 10 });
    const res = await post({ code: "dup", kind: "percent", value: 20 });
    expect(res.status).toBe(409);
    expect(getPromoByCode("DUP")?.value).toBe(10);
  });
});

describe("PATCH /api/admin/promos/[id]", () => {
  it("deactivates a code", async () => {
    const p = createPromo({ code: "OFFME", kind: "percent", value: 10 });
    const res = await patch(p.id, { active: false });
    expect(res.status).toBe(200);
    expect(getPromoByCode("OFFME")?.active).toBe(false);
  });

  it("reactivates a code", async () => {
    const p = createPromo({ code: "ONME", kind: "percent", value: 10 });
    await patch(p.id, { active: false });
    await patch(p.id, { active: true });
    expect(getPromoByCode("ONME")?.active).toBe(true);
  });

  it("404s for an unknown id", async () => {
    const res = await patch("promo_nope", { active: false });
    expect(res.status).toBe(404);
    expect(listPromos()).toHaveLength(0);
  });
});
