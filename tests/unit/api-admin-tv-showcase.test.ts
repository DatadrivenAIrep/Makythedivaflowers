import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { getTvVisibility, setTvVisibility } from "@/lib/tv-showcase-storage";
import { PUT } from "@/app/api/admin/tv-showcase/route";
import { PRODUCTS } from "@/data/products";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const realId = PRODUCTS[0].id;

function put(body: unknown) {
  return PUT(new Request("http://x/api/admin/tv-showcase", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

it("starts empty", () => {
  expect(getTvVisibility().size).toBe(0);
});

it("stores and overwrites a product's choice", () => {
  setTvVisibility(realId, false);
  expect(getTvVisibility().get(realId)).toBe(false);
  setTvVisibility(realId, true);
  expect(getTvVisibility().get(realId)).toBe(true);
  expect(getTvVisibility().size).toBe(1);
});

it("PUT saves the choice", async () => {
  const res = await put({ productId: realId, visible: false });
  expect(res.status).toBe(200);
  expect(getTvVisibility().get(realId)).toBe(false);
});

it("PUT rejects a non-boolean visible", async () => {
  const res = await put({ productId: realId, visible: "no" });
  expect(res.status).toBe(400);
  expect(getTvVisibility().size).toBe(0);
});

it("PUT rejects an unknown product", async () => {
  const res = await put({ productId: "nope", visible: true });
  expect(res.status).toBe(404);
  expect(getTvVisibility().size).toBe(0);
});
