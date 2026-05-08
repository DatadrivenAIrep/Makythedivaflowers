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
