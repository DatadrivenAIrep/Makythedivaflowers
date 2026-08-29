import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { upsertOnOrder, getByPhoneUS } from "@/lib/customer-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("getByPhoneUS", () => {
  beforeEach(() => {
    upsertOnOrder({
      name: "Ana Buyer",
      phone: "5168512815",
      orderAt: "2026-08-01T00:00:00Z",
      locale: "es",
    });
  });

  it("matches an E.164 +1 number against a 10-digit stored phone", () => {
    const c = getByPhoneUS("+15168512815");
    expect(c?.name).toBe("Ana Buyer");
  });

  it("matches a plain 10-digit input too", () => {
    expect(getByPhoneUS("5168512815")?.name).toBe("Ana Buyer");
  });

  it("matches a formatted input", () => {
    expect(getByPhoneUS("(516) 851-2815")?.name).toBe("Ana Buyer");
  });

  it("returns null for an unknown number", () => {
    expect(getByPhoneUS("+17025550000")).toBeNull();
  });
});
