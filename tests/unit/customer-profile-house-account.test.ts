import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createAccount, linkContact } from "@/lib/house-account-storage";
import { getCustomerProfile } from "@/lib/customer-profile";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("profile carries the linked house account", () => {
  getDb().prepare("INSERT INTO customers (id, name, phone, order_count, first_seen_at, last_seen_at) VALUES ('cus_1', 'Ana', '5165550100', 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')").run();
  expect(getCustomerProfile("cus_1")?.houseAccount).toBeUndefined();
  const a = createAccount({ name: "Hotel" });
  linkContact(a.id, "cus_1");
  expect(getCustomerProfile("cus_1")?.houseAccount).toEqual({ id: a.id, name: "Hotel" });
});
