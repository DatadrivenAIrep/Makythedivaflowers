import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

vi.mock("@/lib/inquiry-storage", () => ({ saveInquiry: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/notify-inquiry", () => ({ notifyInquiry: vi.fn().mockResolvedValue(undefined) }));
const notifyOwnerMock = vi.fn();
vi.mock("@/lib/notify-owner", () => ({ notifyOwner: (...a: unknown[]) => notifyOwnerMock(...a) }));

import { POST } from "@/app/api/inquiry/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); notifyOwnerMock.mockReset(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("texts the owner about a new wedding lead", async () => {
  const res = await POST(new Request("http://x/api/inquiry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "wedding",
      contact: { name: "Ana", email: "ana@x.com", phone: "5165551234" },
      budgetBand: "10-25k",
      vibe: "Romantic garden wedding with white roses",
      locale: "es",
      honeypot: "",
    }),
  }));
  expect(res.status).toBe(200);
  expect(notifyOwnerMock).toHaveBeenCalledWith(expect.stringContaining("Ana"));
});
