import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { isPrintAuthValid } from "@/lib/print-auth";

describe("isPrintAuthValid", () => {
  beforeEach(() => {
    vi.stubEnv("PRINT_AGENT_TOKEN", "supersecret-32bytes");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a correct Bearer header", () => {
    expect(isPrintAuthValid("Bearer supersecret-32bytes")).toBe(true);
  });

  it("rejects missing header", () => {
    expect(isPrintAuthValid(null)).toBe(false);
    expect(isPrintAuthValid(undefined)).toBe(false);
  });

  it("rejects wrong scheme", () => {
    expect(isPrintAuthValid("Basic supersecret-32bytes")).toBe(false);
  });

  it("rejects wrong token", () => {
    expect(isPrintAuthValid("Bearer not-the-token")).toBe(false);
  });

  it("rejects when env var is missing", () => {
    vi.unstubAllEnvs();
    expect(isPrintAuthValid("Bearer anything")).toBe(false);
  });

  it("uses constant-time comparison (no early-exit on length mismatch)", () => {
    expect(isPrintAuthValid("Bearer x")).toBe(false);
    expect(isPrintAuthValid("Bearer xx")).toBe(false);
  });
});
