import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry } from "@/lib/inquiry-storage-db";
import { buildTvBoard } from "@/lib/tv-board";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  vi.useFakeTimers().setSystemTime(new Date("2026-05-25T14:00:00Z"));
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

it("embeds the attention snapshot in the board response", async () => {
  createInquiry({ id: "c1", type: "contact", contactName: "Luis", contactEmail: "l@x.com", contactPhone: "", sourceChannel: "web" });
  const board = await buildTvBoard(new Date("2026-05-25T14:00:00Z"));
  expect(board.attention.counts.contacts).toBe(1);
  expect(board.attention.counts.total).toBe(1);
});
