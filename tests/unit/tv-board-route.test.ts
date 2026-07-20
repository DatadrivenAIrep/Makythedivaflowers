process.env.SQLITE_FILE = ":memory:";
process.env.ORDER_STORAGE_FILE = "/tmp/diva-board-route-test.json";
process.env.INTAKE_SESSION_SECRET = "test-secret-test-secret-test-secret";

import { describe, it, expect, beforeEach } from "vitest";
import { runMigrations } from "@/lib/db-migrate";
import { getDb } from "@/lib/db";
import { signSession } from "@/lib/admin-auth";
import { GET } from "@/app/api/admin/tv/board/route";

beforeEach(() => {
  runMigrations();
  getDb().prepare("DELETE FROM orders").run();
});

describe("GET /api/admin/tv/board", () => {
  it("401s without a valid session cookie", async () => {
    const res = await GET(new Request("http://x/api/admin/tv/board"));
    expect(res.status).toBe(401);
  });

  it("200s with a valid session cookie and returns board shape", async () => {
    const token = signSession();
    const res = await GET(new Request("http://x/api/admin/tv/board", {
      headers: { cookie: `intake_session=${token}` },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("todo");
    expect(body).toHaveProperty("enRuta");
    expect(body).toHaveProperty("tomorrow");
    expect(body).toHaveProperty("paidEvents");
    expect(body).toHaveProperty("shopDate");
  });
});
