process.env.SQLITE_FILE = ":memory:";
process.env.ORDER_STORAGE_FILE = "/tmp/diva-board-build-test.json";

import { describe, it, expect, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db-migrate";
import { getDb } from "@/lib/db";
import { saveOrder } from "@/lib/order-storage";
import { buildTvBoard } from "@/lib/tv-board";
import { makeOrder } from "../factories/order";

beforeEach(() => {
  runMigrations();
  getDb().prepare("DELETE FROM orders").run();
});

describe("buildTvBoard", () => {
  it("returns a fully shaped response on an empty DB", async () => {
    const now = new Date("2026-07-20T14:15:00Z");
    const board = await buildTvBoard(now);
    expect(board.shopDate).toBe("2026-07-20");
    expect(board.todo).toEqual([]);
    expect(board.enRuta).toEqual([]);
    expect(board.deliveredToday).toBe(0);
    expect(board.tomorrow.total).toBe(0);
    expect(Array.isArray(board.paidEvents)).toBe(true);
    expect(typeof board.generatedAt).toBe("string");
  });

  it("includes a seeded paid order in todo", async () => {
    await saveOrder(makeOrder({ id: "seed", windowDate: "2026-07-20", slot: "midday", paymentStatus: "paid", status: "pending" }));
    const board = await buildTvBoard(new Date("2026-07-20T14:15:00Z"));
    expect(board.todo.map((c) => c.orderId)).toContain("seed");
  });
});
