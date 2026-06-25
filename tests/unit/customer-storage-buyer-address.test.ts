import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { upsertOnOrder, getByPhone } from "@/lib/customer-storage";
import type { Address } from "@/types/address";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const buyer: Address = { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" };

describe("buyer address persistence", () => {
  it("stores buyerAddress on insert and returns it on lookup", () => {
    upsertOnOrder({ name: "Juan", phone: "5165550100", buyerAddress: buyer, orderAt: "2026-06-25T00:00:00Z" });
    const c = getByPhone("5165550100");
    expect(c?.buyerAddress?.street1).toBe("12 Willis Ave");
  });

  it("preserves buyerAddress on a later order that omits it (COALESCE)", () => {
    upsertOnOrder({ name: "Juan", phone: "5165550100", buyerAddress: buyer, orderAt: "2026-06-25T00:00:00Z" });
    upsertOnOrder({ name: "Juan", phone: "5165550100", orderAt: "2026-06-26T00:00:00Z" });
    expect(getByPhone("5165550100")?.buyerAddress?.zip).toBe("11507");
  });

  it("leaves buyerAddress undefined when never provided", () => {
    upsertOnOrder({ name: "Ana", phone: "5165550200", orderAt: "2026-06-25T00:00:00Z" });
    expect(getByPhone("5165550200")?.buyerAddress).toBeUndefined();
  });
});
