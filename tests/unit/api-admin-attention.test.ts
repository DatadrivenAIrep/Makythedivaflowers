import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry } from "@/lib/inquiry-storage-db";
import { GET } from "@/app/api/admin/attention/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("returns the attention snapshot shape", async () => {
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.generatedAt).toBeTruthy();
  expect(body.counts.contacts).toBe(1);
  expect(body.counts.total).toBe(1);
  expect(body.items[0].kind).toBe("contact");
});
