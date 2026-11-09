import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createCode, checkCode, signProof, readProof } from "@/lib/loyalty-proof";

const REWARDS = [{ id: "r1", percent: 10, label: "10% off" }];

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("ORDER_STORAGE_FILE", "/tmp/diva-test-loyalty-proof-" + process.pid + ".json");
  vi.stubEnv("LOYALTY_API_KEY", "test-key");
  runMigrations();
});
afterEach(() => {
  vi.useRealTimers();
  closeDb();
  vi.unstubAllEnvs();
});

describe("proof", () => {
  it("proof signed for +15165550100 reads back with phone '(516) 555-0100'", () => {
    const token = signProof("+15165550100", REWARDS);
    expect(readProof(token, "(516) 555-0100")).toEqual({ rewards: REWARDS });
  });

  it("proof is rejected for another phone, after 15 minutes, and when tampered", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    const token = signProof("5165550100", REWARDS, now);
    expect(readProof(token, "5165550199", now)).toBeNull();
    expect(readProof(token, "5165550100", new Date(now.getTime() + 14 * 60_000))).not.toBeNull();
    expect(readProof(token, "5165550100", new Date(now.getTime() + 15 * 60_000 + 1))).toBeNull();

    const [body, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), r: [{ id: "r1", percent: 99, label: "x" }] }),
    ).toString("base64url");
    expect(readProof(`${forged}.${sig}`, "5165550100", now)).toBeNull();
    expect(readProof(`${body}.${sig}x`, "5165550100", now)).toBeNull();
    expect(readProof("garbage", "5165550100", now)).toBeNull();
    // A different key must not validate the token.
    vi.stubEnv("LOYALTY_API_KEY", "other-key");
    expect(readProof(token, "5165550100", now)).toBeNull();
  });
});

describe("codes", () => {
  it("creates a 6 digit code and accepts it", () => {
    const code = createCode("5165550100");
    expect(code).toMatch(/^\d{6}$/);
    expect(checkCode("(516) 555-0100", code)).toBe("ok");
  });

  it("code expires after 10 minutes and dies on the fifth wrong attempt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
    const code = createCode("5165550100");
    vi.setSystemTime(new Date("2026-11-08T12:10:01Z"));
    expect(checkCode("5165550100", code)).toBe("expired");

    vi.setSystemTime(new Date("2026-11-08T13:00:00Z"));
    const code2 = createCode("5165550100");
    const wrong = code2 === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(checkCode("5165550100", wrong)).toBe("wrong");
    // The fifth miss burned it: even the right code no longer works.
    expect(checkCode("5165550100", code2)).not.toBe("ok");
    expect(getDb().prepare("SELECT COUNT(*) AS n FROM loyalty_sms_codes").get()).toEqual({ n: 0 });
  });

  it("a used code cannot be used twice", () => {
    const code = createCode("5165550100");
    expect(checkCode("5165550100", code)).toBe("ok");
    expect(checkCode("5165550100", code)).not.toBe("ok");
  });

  it("a new code replaces the previous one", () => {
    const a = createCode("5165550100");
    let b = createCode("5165550100");
    while (b === a) b = createCode("5165550100");
    expect(checkCode("5165550100", a)).toBe("wrong");
    expect(checkCode("5165550100", b)).toBe("ok");
  });

  it("stores only a hash", () => {
    const code = createCode("5165550100");
    const row = getDb().prepare("SELECT code_hash FROM loyalty_sms_codes").get() as { code_hash: string };
    expect(row.code_hash).not.toContain(code);
  });
});
