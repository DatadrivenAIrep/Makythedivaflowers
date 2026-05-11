import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Order } from "@/types/order";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-print-queue-${process.pid}.json`);

const baseOrder: Order = {
  id: "do_q1",
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

// Render is no longer called by the queue (the agent renders locally),
// so we no longer need to mock it. The original mock is kept commented
// for context.

beforeEach(async () => {
  vi.stubEnv("PRINT_QUEUE_FILE", TEST_FILE);
  await fs.writeFile(TEST_FILE, "[]", "utf8");
});
afterEach(async () => {
  try { await fs.unlink(TEST_FILE); } catch {}
  vi.unstubAllEnvs();
});

describe("print-queue storage", () => {
  it("returns empty list for fresh queue", async () => {
    const { __readAll } = await import("@/lib/print-queue");
    expect(await __readAll()).toEqual([]);
  });

  it("returns empty when file does not exist", async () => {
    await fs.unlink(TEST_FILE);
    const { __readAll } = await import("@/lib/print-queue");
    expect(await __readAll()).toEqual([]);
  });
});

describe("print-queue state machine", () => {
  it("enqueuePrintJob adds a pending job with order metadata only", async () => {
    const { enqueuePrintJob, __readAll } = await import("@/lib/print-queue");
    const job = await enqueuePrintJob(baseOrder);
    expect(job.status).toBe("pending");
    expect(job.orderId).toBe("do_q1");
    expect(job.attempts).toBe(0);
    const all = await __readAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(job.id);
    // No PDF bytes stored in the job — the agent renders on demand.
    expect((all[0] as Record<string, unknown>).pdfBase64).toBeUndefined();
  });

  it("claimPendingJobs flips pending → printing and returns the claimed jobs", async () => {
    const { enqueuePrintJob, claimPendingJobs, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await enqueuePrintJob({ ...baseOrder, id: "do_q2" });

    const claimed = await claimPendingJobs(10);
    expect(claimed).toHaveLength(2);
    expect(claimed.every((j) => j.status === "printing")).toBe(true);

    const all = await __readAll();
    expect(all.every((j) => j.status === "printing")).toBe(true);
  });

  it("claimPendingJobs respects the limit", async () => {
    const { enqueuePrintJob, claimPendingJobs } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await enqueuePrintJob({ ...baseOrder, id: "do_q2" });
    await enqueuePrintJob({ ...baseOrder, id: "do_q3" });

    const claimed = await claimPendingJobs(2);
    expect(claimed).toHaveLength(2);
  });

  it("ackJob('printed') marks the job printed and stamps printedAt", async () => {
    const { enqueuePrintJob, claimPendingJobs, ackJob, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const [j] = await claimPendingJobs(1);
    await ackJob(j.id, "printed");
    const all = await __readAll();
    expect(all[0].status).toBe("printed");
    expect(all[0].printedAt).toBeTruthy();
  });

  it("ackJob('failed', err) marks failed, increments attempts, stores error", async () => {
    const { enqueuePrintJob, claimPendingJobs, ackJob, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    const [j] = await claimPendingJobs(1);
    await ackJob(j.id, "failed", "printer offline");
    const all = await __readAll();
    expect(all[0].status).toBe("failed");
    expect(all[0].error).toBe("printer offline");
    expect(all[0].attempts).toBe(1);
  });

  it("recoverStuckJobs flips printing → pending after timeout", async () => {
    const { enqueuePrintJob, claimPendingJobs, recoverStuckJobs, __readAll } = await import("@/lib/print-queue");
    await enqueuePrintJob(baseOrder);
    await claimPendingJobs(1);
    // Backdate updatedAt to 6 minutes ago.
    const all = await __readAll();
    all[0].updatedAt = new Date(Date.now() - 6 * 60_000).toISOString();
    await fs.writeFile(TEST_FILE, JSON.stringify(all), "utf8");

    const recovered = await recoverStuckJobs(5 * 60_000);
    expect(recovered).toBe(1);
    const after = await __readAll();
    expect(after[0].status).toBe("pending");
  });
});
