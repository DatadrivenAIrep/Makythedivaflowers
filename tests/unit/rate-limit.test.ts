// tests/unit/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit, __resetRateLimitForTests } from "@/lib/rate-limit";

beforeEach(() => {
  __resetRateLimitForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("allows up to N requests per window, then blocks", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 }).ok).toBe(true);
    }
    expect(rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 }).ok).toBe(false);
  });

  it("resets after the window passes", () => {
    for (let i = 0; i < 5; i++) rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 });
    vi.advanceTimersByTime(61_000);
    expect(rateLimit("1.2.3.4", { max: 5, windowMs: 60_000 }).ok).toBe(true);
  });

  it("buckets per-IP", () => {
    for (let i = 0; i < 5; i++) rateLimit("1.1.1.1", { max: 5, windowMs: 60_000 });
    expect(rateLimit("1.1.1.1", { max: 5, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit("2.2.2.2", { max: 5, windowMs: 60_000 }).ok).toBe(true);
  });
});
