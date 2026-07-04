import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listInquiries } from "@/lib/inquiry-storage-db";

// Isolate side effects: JSON storage + email are stubbed so the test only
// checks the SQLite dual-write branch.
vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: vi.fn(async () => {}) }));
vi.mock("@/lib/notify-inquiry", () => ({ notifyInquiry: vi.fn(async () => {}) }));

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

async function post(body: unknown) {
  const { POST } = await import("@/app/api/inquiry/route");
  return POST(new Request("http://x/api/inquiry", { method: "POST", body: JSON.stringify(body) }));
}

const wedding = {
  type: "wedding", contact: { name: "Ana", email: "ana@x.com", phone: "5165551234" },
  budgetBand: "10-25k", vibe: "romantic garden party with lots of white", locale: "es", honeypot: "",
  date: "2027-06-01", venue: "Glen Cove", guests: 120,
};

it("wedding inquiry lands in SQLite at stage nuevo", async () => {
  const res = await post(wedding);
  expect(res.status).toBe(200);
  const all = listInquiries();
  expect(all).toHaveLength(1);
  expect(all[0].type).toBe("wedding");
  expect(all[0].stage).toBe("nuevo");
  expect(all[0].sourceChannel).toBe("web");
  expect(all[0].contactName).toBe("Ana");
});

it("contact/subscription inquiries do NOT create a pipeline row", async () => {
  await post({ type: "subscription", contact: { name: "Z", email: "z@x.com", phone: "5165550000" },
    budgetBand: "open", vibe: "weekly lobby flowers for our office", locale: "en", honeypot: "",
    company: "Acme", frequency: "weekly" });
  expect(listInquiries()).toHaveLength(0);
});
