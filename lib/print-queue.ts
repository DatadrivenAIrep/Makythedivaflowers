// lib/print-queue.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PrintJob, PrintJobStatus } from "@/types/print-job";
import type { Order } from "@/types/order";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

function storageFile(): string {
  const override = process.env.PRINT_QUEUE_FILE;
  if (override) return path.isAbsolute(override) ? override : path.resolve(override);
  return path.join(process.cwd(), "print-queue.json");
}

function mirrorJob(job: PrintJob): void {
  try {
    runMigrations();
    const db = getDb();
    db.prepare(
      `INSERT INTO print_jobs (id, order_id, status, attempts, error, created_at, updated_at, printed_at)
       VALUES (@id, @order_id, @status, @attempts, @error, @created_at, @updated_at, @printed_at)
       ON CONFLICT(id) DO UPDATE SET
         order_id=excluded.order_id,
         status=excluded.status,
         attempts=excluded.attempts,
         error=excluded.error,
         updated_at=excluded.updated_at,
         printed_at=excluded.printed_at`,
    ).run({
      id: job.id,
      order_id: job.orderId,
      status: job.status,
      attempts: job.attempts,
      error: job.error ?? null,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      printed_at: job.printedAt ?? null,
    });
  } catch (e) {
    console.error(JSON.stringify({ event: "sqlite_print_mirror_failed", jobId: job.id, error: String(e) }));
  }
}

export async function __readAll(): Promise<PrintJob[]> {
  try {
    const raw = await fs.readFile(storageFile(), "utf8");
    return JSON.parse(raw) as PrintJob[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function __writeAll(all: PrintJob[]): Promise<void> {
  await fs.writeFile(storageFile(), JSON.stringify(all, null, 2), "utf8");
}

function newId(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export async function enqueuePrintJob(order: Order): Promise<PrintJob> {
  // The job only tracks the order id; HTML/PDF rendering is deferred
  // to the queue endpoint (HTML) and the agent (PDF). This avoids
  // running Chromium on the server, which the production host can't do.
  const now = new Date().toISOString();
  const job: PrintJob = {
    id: newId(),
    orderId: order.id,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = await __readAll();
  all.push(job);
  await __writeAll(all);
  mirrorJob(job);
  console.log(JSON.stringify({ event: "print_job_enqueued", orderId: order.id, jobId: job.id }));
  return job;
}

export async function claimPendingJobs(limit: number): Promise<PrintJob[]> {
  const all = await __readAll();
  const pending = all.filter((j) => j.status === "pending").slice(0, limit);
  if (pending.length === 0) return [];
  const now = new Date().toISOString();
  for (const j of pending) {
    j.status = "printing";
    j.updatedAt = now;
  }
  await __writeAll(all);
  for (const j of pending) {
    mirrorJob(j);
  }
  if (pending.length > 0) {
    console.log(JSON.stringify({ event: "print_queue_fetched", count: pending.length, jobIds: pending.map((j) => j.id) }));
  }
  return pending;
}

export async function ackJob(
  id: string,
  status: "printed" | "failed",
  error?: string,
): Promise<void> {
  const all = await __readAll();
  const job = all.find((j) => j.id === id);
  if (!job) return;
  const now = new Date().toISOString();
  job.status = status;
  job.updatedAt = now;
  if (status === "printed") {
    job.printedAt = now;
    job.error = undefined;
  } else {
    job.attempts += 1;
    job.error = error;
  }
  await __writeAll(all);
  mirrorJob(job);
  console.log(JSON.stringify({
    event: status === "printed" ? "print_job_acked" : "print_job_failed",
    jobId: id,
    orderId: job.orderId,
    attempts: job.attempts,
    ...(status === "failed" ? { error } : {}),
  }));
}

export async function recoverStuckJobs(timeoutMs: number): Promise<number> {
  const all = await __readAll();
  const cutoff = Date.now() - timeoutMs;
  let count = 0;
  const now = new Date().toISOString();
  const unstuckJobs: PrintJob[] = [];
  for (const j of all) {
    if (j.status === "printing" && Date.parse(j.updatedAt) < cutoff) {
      j.status = "pending";
      j.updatedAt = now;
      unstuckJobs.push(j);
      count += 1;
    }
  }
  if (count > 0) {
    await __writeAll(all);
    for (const j of unstuckJobs) {
      mirrorJob(j);
    }
    console.log(JSON.stringify({ event: "print_recovery_unstuck", count }));
  }
  return count;
}

export async function getQueueHealth(): Promise<{
  pendingCount: number;
  oldestPendingAgeSeconds: number | null;
  lastPrintedAt: string | null;
}> {
  const all = await __readAll();
  const pending = all.filter((j) => j.status === "pending");
  const oldest = pending
    .map((j) => Date.parse(j.createdAt))
    .reduce<number | null>((min, t) => (min === null || t < min ? t : min), null);
  const printedAts = all
    .filter((j) => j.status === "printed" && j.printedAt)
    .map((j) => j.printedAt as string)
    .sort();
  return {
    pendingCount: pending.length,
    oldestPendingAgeSeconds: oldest === null ? null : Math.floor((Date.now() - oldest) / 1000),
    lastPrintedAt: printedAts.at(-1) ?? null,
  };
}
