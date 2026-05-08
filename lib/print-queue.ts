// lib/print-queue.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PrintJob, PrintJobStatus } from "@/types/print-job";

function storageFile(): string {
  const override = process.env.PRINT_QUEUE_FILE;
  if (override) return path.isAbsolute(override) ? override : path.resolve(override);
  return path.join(process.cwd(), "print-queue.json");
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

import type { Order } from "@/types/order";
import { renderOrderPdf } from "@/lib/print-render";

function newId(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export async function enqueuePrintJob(order: Order): Promise<PrintJob> {
  const pdf = await renderOrderPdf(order);
  const now = new Date().toISOString();
  const job: PrintJob = {
    id: newId(),
    orderId: order.id,
    status: "pending",
    pdfBase64: pdf.toString("base64"),
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  const all = await __readAll();
  all.push(job);
  await __writeAll(all);
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
}

export async function recoverStuckJobs(timeoutMs: number): Promise<number> {
  const all = await __readAll();
  const cutoff = Date.now() - timeoutMs;
  let count = 0;
  const now = new Date().toISOString();
  for (const j of all) {
    if (j.status === "printing" && Date.parse(j.updatedAt) < cutoff) {
      j.status = "pending";
      j.updatedAt = now;
      count += 1;
    }
  }
  if (count > 0) await __writeAll(all);
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
