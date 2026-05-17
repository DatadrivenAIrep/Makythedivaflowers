import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Order } from "@/types/order";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-ack-${process.pid}.json`);

vi.mock("@/lib/print-render", () => ({
  renderOrderPdf: vi.fn(async () => Buffer.from("FAKE")),
}));

// Failure-alert email is exercised separately; stub here.
vi.mock("@/lib/order-notifications", async () => {
  const actual = await vi.importActual<typeof import("@/lib/order-notifications")>(
    "@/lib/order-notifications",
  );
  return { ...actual, notifyPrintFailed: vi.fn() };
});

const baseOrder: Order = {
  id: "do_ack1",
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
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

function req(id: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/print/jobs/${id}/ack`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function enqueueAndClaim(orderOverrides: Partial<Order> = {}) {
  const { enqueuePrintJob, claimPendingJobs } = await import("@/lib/print-queue");
  await enqueuePrintJob({ ...baseOrder, ...orderOverrides });
  const [job] = await claimPendingJobs(1);
  return job;
}

describe("POST /api/print/jobs/[id]/ack", () => {
  it("returns 401 without auth", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(req(job.id, { status: "printed" }), { params: Promise.resolve({ id: job.id }) } as any);
    expect(res.status).toBe(401);
  });

  it("marks the job as printed", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(
      req(job.id, { status: "printed" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    expect(res.status).toBe(200);
    const all = JSON.parse(await fs.readFile(TEST_FILE, "utf8"));
    expect(all[0].status).toBe("printed");
    expect(all[0].printedAt).toBeTruthy();
  });

  it("marks the job as failed and stores the error", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    await POST(
      req(job.id, { status: "failed", error: "printer offline" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    const all = JSON.parse(await fs.readFile(TEST_FILE, "utf8"));
    expect(all[0].status).toBe("failed");
    expect(all[0].error).toBe("printer offline");
  });

  it("rejects malformed body", async () => {
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(
      req(job.id, { status: "weird" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown job id", async () => {
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    const res = await POST(
      req("nope", { status: "printed" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: "nope" }) } as any,
    );
    expect(res.status).toBe(404);
  });

  it("calls notifyPrintFailed on failure", async () => {
    const { notifyPrintFailed } = await import("@/lib/order-notifications");
    const job = await enqueueAndClaim();
    const { POST } = await import("@/app/api/print/jobs/[id]/ack/route");
    await POST(
      req(job.id, { status: "failed", error: "boom" }, { Authorization: "Bearer tok-32bytes" }),
      { params: Promise.resolve({ id: job.id }) } as any,
    );
    expect(notifyPrintFailed).toHaveBeenCalledWith("do_ack1", "boom");
  });
});
