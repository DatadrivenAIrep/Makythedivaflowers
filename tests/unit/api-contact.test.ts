import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { listUnacknowledged } from "@/lib/inquiry-storage-db";

// Isolate the JSON mirror so the test never writes pending-inquiries.json.
vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "@/app/api/contact/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("saves a contact submission as an unacknowledged contact inquiry", async () => {
  const res = await POST(new Request("http://x/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Luis", email: "luis@x.com", subject: "Hola",
      body: "Quiero un ramo grande por favor", locale: "es", honeypot: "",
    }),
  }));
  expect(res.status).toBe(200);
  const contacts = listUnacknowledged(["contact"]);
  expect(contacts).toHaveLength(1);
  expect(contacts[0].contactName).toBe("Luis");
  expect(contacts[0].acknowledgedAt).toBeUndefined();
});
