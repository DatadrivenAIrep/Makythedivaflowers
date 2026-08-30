import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { insertInboundMessage, listInboundMessages } from "@/lib/inbound-storage";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("inbound-storage", () => {
  it("inserts and lists an inbound message", () => {
    insertInboundMessage({ fromPhone: "5168512815", customerId: "cus_1", body: "gracias!", providerSid: "SM1" });
    const rows = listInboundMessages();
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe("gracias!");
    expect(rows[0].customerId).toBe("cus_1");
    expect(rows[0].fromPhone).toBe("5168512815");
  });

  it("allows a null customer for an unknown sender", () => {
    insertInboundMessage({ fromPhone: "9995550000", body: "who is this" });
    expect(listInboundMessages()[0].customerId).toBeUndefined();
  });

  it("lists newest first", () => {
    insertInboundMessage({ fromPhone: "1", body: "a" });
    insertInboundMessage({ fromPhone: "1", body: "b" });
    expect(listInboundMessages().map((r) => r.body).slice(0, 2)).toEqual(["b", "a"]);
  });
});
