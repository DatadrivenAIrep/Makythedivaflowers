import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const TEST_FILE = path.join(os.tmpdir(), `diva-test-print-queue-${process.pid}.json`);

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
