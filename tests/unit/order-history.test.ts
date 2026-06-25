import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { recordOrderChange, listOrderHistory } from "@/lib/order-history";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("order-history", () => {
  it("records and lists a change", async () => {
    await recordOrderChange({ orderId: "o1", actor: "maky", kind: "note", summary: "Nota agregada" });
    const list = await listOrderHistory("o1");
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe("note");
    expect(list[0].summary).toBe("Nota agregada");
    expect(list[0].id).toBeTruthy();
    expect(list[0].at).toBeTruthy();
  });

  it("round-trips a field diff via changes_json", async () => {
    await recordOrderChange({
      orderId: "o2", actor: "maky", kind: "edit", summary: "Editó: Total",
      changes: [{ field: "totals.totalCents", label: "Total", before: "$50.00", after: "$60.00" }],
    });
    const list = await listOrderHistory("o2");
    expect(list[0].changes?.[0].label).toBe("Total");
    expect(list[0].changes?.[0].after).toBe("$60.00");
  });

  it("lists in chronological (ascending) order, scoped to the order", async () => {
    await recordOrderChange({ orderId: "o3", actor: "maky", kind: "created", summary: "a" });
    await recordOrderChange({ orderId: "o3", actor: "maky", kind: "payment", summary: "b" });
    await recordOrderChange({ orderId: "other", actor: "maky", kind: "created", summary: "x" });
    const list = await listOrderHistory("o3");
    expect(list.map((c) => c.summary)).toEqual(["a", "b"]);
  });
});
