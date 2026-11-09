import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const runDuePending = vi.fn();
vi.mock("@/lib/loyalty-sync", () => ({ runDuePending: (...a: unknown[]) => runDuePending(...a) }));

import { POST } from "@/app/api/cron/loyalty-sync/route";

beforeEach(() => {
  runDuePending.mockReset();
  runDuePending.mockResolvedValue({ done: 2, pending: 1, failed: 0 });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const req = (auth?: string) =>
  new Request("http://x/api/cron/loyalty-sync", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });

describe("loyalty-sync cron", () => {
  it("returns 503 without CRON_SECRET and 401 with a wrong one", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(req("Bearer s3cret"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await POST(req("Bearer nope"))).status).toBe(401);
    expect((await POST(req())).status).toBe(401);
    expect(runDuePending).not.toHaveBeenCalled();
  });

  it("returns the counts from runDuePending", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await POST(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ done: 2, pending: 1, failed: 0 });
  });
});
