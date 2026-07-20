import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveOrder, listOrdersForWindowDates } from "@/lib/order-storage";
import { makeOrder } from "../factories/order";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-board-test-" + process.pid + ".json");
  runMigrations();
  getDb().prepare("DELETE FROM orders").run();
});
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("listOrdersForWindowDates", () => {
  it("returns delivery/pickup orders for the given window dates, excluding canceled and in-store", async () => {
    await saveOrder(makeOrder({ id: "a", windowDate: "2026-07-20", method: "delivery" }));
    await saveOrder(makeOrder({ id: "b", windowDate: "2026-07-20", method: "pickup" }));
    await saveOrder(makeOrder({ id: "c", windowDate: "2026-07-21", method: "delivery" }));
    await saveOrder(makeOrder({ id: "d", windowDate: "2026-07-19", method: "delivery" })); // other day
    await saveOrder(makeOrder({ id: "e", windowDate: "2026-07-20", method: "delivery", status: "canceled" }));
    await saveOrder(makeOrder({ id: "f", method: "in-store" })); // no window

    const rows = await listOrdersForWindowDates(["2026-07-20", "2026-07-21"]);
    const ids = rows.map((o) => o.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("returns [] for empty date list", async () => {
    expect(await listOrdersForWindowDates([])).toEqual([]);
  });
});
