import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/admin/customers/lookup/route";
import { upsertOnOrder } from "@/lib/customer-storage";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function get(phone: string): Request {
  return new Request(`http://localhost/api/admin/customers/lookup?phone=${encodeURIComponent(phone)}`);
}

describe("GET /api/admin/customers/lookup", () => {
  it("returns found: false when no customer matches", async () => {
    const res = await GET(get("5165550100"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ found: false });
  });

  it("returns the customer when phone matches", async () => {
    upsertOnOrder({ name: "Maria", phone: "5165550100", orderAt: "2026-05-16T00:00:00Z" });
    const res = await GET(get("(516) 555-0100"));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.customer.name).toBe("Maria");
  });

  it("returns 400 on missing phone param", async () => {
    const res = await GET(new Request("http://localhost/api/admin/customers/lookup"));
    expect(res.status).toBe(400);
  });
});
