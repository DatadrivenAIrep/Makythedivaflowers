import { describe, it, expect, beforeEach, vi } from "vitest";
import { signSession } from "@/lib/admin-auth";
import { verifySessionEdge } from "@/lib/admin-auth-edge";

beforeEach(() => {
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-32-chars-minimum-1234");
});

describe("verifySessionEdge", () => {
  it("accepts a token signed by signSession", async () => {
    const token = signSession();
    expect(await verifySessionEdge(token)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const token = signSession({ ttlSeconds: -1 });
    expect(await verifySessionEdge(token)).toBe(false);
  });

  it("rejects a malformed token", async () => {
    expect(await verifySessionEdge("garbage")).toBe(false);
  });
});
