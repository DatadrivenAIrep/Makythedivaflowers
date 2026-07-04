import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry, changeStage } from "@/lib/inquiry-storage-db";
import { GET, POST } from "@/app/api/admin/inquiries/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

it("GET returns inquiries + stats (counts + open value)", async () => {
  createInquiry({ id: "iq1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com",
    contactPhone: "5551", budgetBand: "10-25k", sourceChannel: "web" });
  createInquiry({ id: "iq2", type: "event", contactName: "Bob", contactEmail: "b@x.com",
    contactPhone: "5552", budgetBand: "25k+", sourceChannel: "manual" });
  changeStage("iq2", "reservado", "maky");

  const res = await GET(new Request("http://x/api/admin/inquiries"));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.inquiries).toHaveLength(2);
  expect(body.stats.counts.nuevo).toBe(1);
  expect(body.stats.counts.reservado).toBe(1);
  expect(body.stats.openValueCents).toBe(3500000); // 1,000,000 + 2,500,000
});

it("POST creates a manual lead at stage nuevo", async () => {
  const res = await POST(new Request("http://x", {
    method: "POST",
    body: JSON.stringify({ type: "wedding", contact: { name: "Cara", email: "c@x.com", phone: "5165551234" },
      budgetBand: "5-10k", eventDate: "2027-05-01", guests: 80 }),
  }));
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.inquiry.stage).toBe("nuevo");
  expect(body.inquiry.sourceChannel).toBe("manual");
  expect(body.inquiry.contactName).toBe("Cara");
});

it("POST 400s on an invalid body", async () => {
  const bad = await POST(new Request("http://x", { method: "POST",
    body: JSON.stringify({ type: "bogus", contact: { name: "X", email: "no", phone: "1" } }) }));
  expect(bad.status).toBe(400);
});
