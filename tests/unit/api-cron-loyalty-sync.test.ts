import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const runDuePending = vi.fn();
vi.mock("@/lib/loyalty-sync", () => ({ runDuePending: (...a: unknown[]) => runDuePending(...a) }));

const runDueBonuses = vi.fn();
vi.mock("@/lib/loyalty-bonus", () => ({ runDueBonuses: (...a: unknown[]) => runDueBonuses(...a) }));

import { POST } from "@/app/api/cron/loyalty-sync/route";

beforeEach(() => {
  runDuePending.mockReset();
  runDuePending.mockResolvedValue({ done: 2, pending: 1, failed: 0 });
  runDueBonuses.mockReset();
  runDueBonuses.mockResolvedValue({ done: 1, pending: 0, failed: 0 });
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

  it("without the flag, leaves the bonus queue alone and answers as before", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("DATE_REWARDS_ENABLED", "");
    const body = await (await POST(req("Bearer s3cret"))).json();
    expect(body).toEqual({ done: 2, pending: 1, failed: 0 });
    expect(runDueBonuses).not.toHaveBeenCalled();
  });

  it("with DATE_REWARDS_ENABLED, adds the bonus counts", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("DATE_REWARDS_ENABLED", "1");
    const body = await (await POST(req("Bearer s3cret"))).json();
    expect(body).toEqual({ done: 2, pending: 1, failed: 0, bonus: { done: 1, pending: 0, failed: 0 } });
  });
});
