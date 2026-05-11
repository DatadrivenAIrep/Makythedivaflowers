import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Order } from "@/types/order";
import { __resetRateLimitForTests } from "@/lib/rate-limit";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-print-api-${process.pid}.json`);

vi.mock("@/lib/print-render", () => ({
  renderOrderPdf: vi.fn(async () => Buffer.from("FAKE")),
}));

const baseOrder: Order = {
  id: "do_api1",
  locale: "en",
  lines: [],
  contact: { email: "x@y.com", phone: "5555555555" },
  totals: { subtotalCents: 1000, deliveryCents: 0, taxCents: 0, totalCents: 1000 },
  status: "paid",
  createdAt: "2026-05-07T00:00:00.000Z",
  delivery: {
    method: "pickup",
    recipient: { name: "R", phone: "5555555555" },
    window: { date: "2099-01-01", slot: "midday" },
  },
};

beforeEach(async () => {
  vi.stubEnv("PRINT_QUEUE_FILE", TEST_FILE);
  vi.stubEnv("PRINT_AGENT_TOKEN", "test-token-32bytes");
  await fs.writeFile(TEST_FILE, "[]", "utf8");
  __resetRateLimitForTests();
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/print/queue", { method: "GET", headers });
}

describe("GET /api/print/queue", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req({ Authorization: "Bearer wrong-token" }));
    expect(res.status).toBe(401);
  });

  it("returns empty jobs array when queue is empty", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs).toEqual([]);
  });

  it("returns pending jobs and flips them to printing", async () => {
    const { enqueuePrintJob } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const { GET } = await import("@/app/api/print/queue/route");
    const res = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0]).toMatchObject({ orderId: "do_api1" });
    expect(typeof body.jobs[0].pdfBase64).toBe("string");

    // Second poll returns nothing — already claimed.
    const res2 = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect((await res2.json()).jobs).toEqual([]);
  });

  it("recovers stuck jobs (printing > 5min old) and re-claims them", async () => {
    const { enqueuePrintJob } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const { GET } = await import("@/app/api/print/queue/route");
    await GET(req({ Authorization: "Bearer test-token-32bytes" })); // claim

    // Backdate updatedAt
    const raw = JSON.parse(await fs.readFile(TEST_FILE, "utf8"));
    raw[0].updatedAt = new Date(Date.now() - 6 * 60_000).toISOString();
    await fs.writeFile(TEST_FILE, JSON.stringify(raw), "utf8");

    const res = await GET(req({ Authorization: "Bearer test-token-32bytes" }));
    expect((await res.json()).jobs).toHaveLength(1);
  });

  it("rate-limits after 30 requests in a minute", async () => {
    const { GET } = await import("@/app/api/print/queue/route");
    const auth = { Authorization: "Bearer test-token-32bytes" };
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) last = await GET(req(auth));
    expect(last!.status).toBe(429);
  });
});
