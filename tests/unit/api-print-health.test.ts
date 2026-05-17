import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Order } from "@/types/order";
import { closeDb } from "@/lib/db";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-health-${process.pid}.json`);

vi.mock("@/lib/print-render", () => ({
  renderOrderPdf: vi.fn(async () => Buffer.from("FAKE")),
}));

const baseOrder: Order = {
  id: "do_h1",
  source: "web",
  locale: "en",
  lines: [],
  contact: { email: "x@y.com", phone: "5555555555" },
  totals: { subtotalCents: 1000, deliveryCents: 0, taxCents: 0, totalCents: 1000 },
  status: "pending",
  paymentStatus: "paid",
  createdAt: "2026-05-07T00:00:00.000Z",
  updatedAt: "2026-05-07T00:00:00.000Z",
  fulfillment: {
    method: "pickup",
    recipient: { name: "R", phone: "5555555555" },
    window: { date: "2099-01-01", slot: "midday" },
  },
};

beforeEach(async () => {
  vi.stubEnv("PRINT_QUEUE_FILE", TEST_FILE);
  vi.stubEnv("PRINT_AGENT_TOKEN", "tok-32bytes");
  vi.stubEnv("SQLITE_FILE", ":memory:");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
});
afterEach(async () => {
  closeDb();
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

const auth = { Authorization: "Bearer tok-32bytes" };
const req = (h: Record<string, string> = {}) =>
  new Request("http://localhost/api/print/health", { method: "GET", headers: h });

describe("GET /api/print/health", () => {
  it("returns 401 without auth", async () => {
    const { GET } = await import("@/app/api/print/health/route");
    expect((await GET(req())).status).toBe(401);
  });

  it("reports 0 pending and null lastPrintedAt for empty queue", async () => {
    const { GET } = await import("@/app/api/print/health/route");
    const res = await GET(req(auth));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ pendingCount: 0, oldestPendingAgeSeconds: null, lastPrintedAt: null });
  });

  it("reports counts for mixed queue", async () => {
    const { enqueuePrintJob, claimPendingJobs, ackJob } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await enqueuePrintJob({ ...baseOrder, id: "do_h2" });
    const [first] = await claimPendingJobs(1);
    await ackJob(first.id, "printed");

    const { GET } = await import("@/app/api/print/health/route");
    const body = await (await GET(req(auth))).json();
    expect(body.pendingCount).toBe(1);
    expect(body.lastPrintedAt).toBeTruthy();
    expect(body.oldestPendingAgeSeconds).toBeGreaterThanOrEqual(0);
  });
});
