import { describe, it, expect, beforeEach, vi } from "vitest";
import { signSession, verifySession } from "@/lib/admin-auth";

beforeEach(() => {
  vi.stubEnv("INTAKE_SESSION_SECRET", "test-secret-32-chars-minimum-1234");
});

describe("admin-auth", () => {
  it("signs and verifies a fresh session", () => {
    const token = signSession();
    const ok = verifySession(token);
    expect(ok).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSession();
    vi.stubEnv("INTAKE_SESSION_SECRET", "different-secret-32-chars-1234567");
    expect(verifySession(token)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signSession({ ttlSeconds: -1 });
    expect(verifySession(token)).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifySession("garbage")).toBe(false);
    expect(verifySession("a.b")).toBe(false);
  });
});
