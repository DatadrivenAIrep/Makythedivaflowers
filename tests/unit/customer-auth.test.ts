import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  signCustomerSession,
  verifyCustomerSession,
  issueLoginCode,
  checkLoginCode,
  MAX_CODE_ATTEMPTS,
} from "@/lib/customer-auth";
import { verifySession as verifyAdminSession, signSession as signAdminSession } from "@/lib/admin-auth";

const SECRET = "a".repeat(48);

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", SECRET);
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedCustomer(id: string, phone: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, first_seen_at, last_seen_at)
       VALUES (?, 'María', ?, ?, ?)`,
    )
    .run(id, phone, now, now);
}

describe("customer sessions", () => {
  it("round-trips the customer id", () => {
    const token = signCustomerSession("cus_1");
    expect(verifyCustomerSession(token)).toBe("cus_1");
  });

  it("rejects a tampered token", () => {
    const token = signCustomerSession("cus_1");
    const tampered = token.replace(/^./, (c) => (c === "a" ? "b" : "a"));
    expect(verifyCustomerSession(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signCustomerSession("cus_1", { ttlSeconds: -1 });
    expect(verifyCustomerSession(token)).toBeNull();
  });

  it("rejects junk", () => {
    expect(verifyCustomerSession("")).toBeNull();
    expect(verifyCustomerSession("nope")).toBeNull();
    expect(verifyCustomerSession("a.b")).toBeNull();
  });

  // The two session kinds share one secret, so they must be domain-separated:
  // a customer cookie that also opens the admin would be a full compromise.
  it("a customer token does not authenticate as admin", () => {
    const token = signCustomerSession("cus_1");
    expect(verifyAdminSession(token)).toBe(false);
  });

  it("an admin token is not a valid customer session", () => {
    expect(verifyCustomerSession(signAdminSession())).toBeNull();
  });
});

describe("login codes", () => {
  it("issues a six-digit code for a known customer", () => {
    seedCustomer("cus_1", "5165550100");
    const issued = issueLoginCode("5165550100");
    expect(issued).toBeTruthy();
    expect(issued!.code).toMatch(/^\d{6}$/);
    expect(issued!.customerId).toBe("cus_1");
  });

  it("issues nothing for a phone with no customer", () => {
    expect(issueLoginCode("5169999999")).toBeNull();
  });

  it("matches a phone typed with punctuation", () => {
    seedCustomer("cus_1", "5165550100");
    expect(issueLoginCode("(516) 555-0100")?.customerId).toBe("cus_1");
  });

  it("accepts the right code once and signs the customer in", () => {
    seedCustomer("cus_1", "5165550100");
    const { code } = issueLoginCode("5165550100")!;
    expect(checkLoginCode("5165550100", code)).toEqual({ ok: true, customerId: "cus_1" });
  });

  it("does not accept the same code twice", () => {
    seedCustomer("cus_1", "5165550100");
    const { code } = issueLoginCode("5165550100")!;
    checkLoginCode("5165550100", code);
    expect(checkLoginCode("5165550100", code).ok).toBe(false);
  });

  it("rejects a wrong code", () => {
    seedCustomer("cus_1", "5165550100");
    const { code } = issueLoginCode("5165550100")!;
    const wrong = code === "000000" ? "111111" : "000000";
    expect(checkLoginCode("5165550100", wrong)).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks the code after too many wrong guesses", () => {
    seedCustomer("cus_1", "5165550100");
    const { code } = issueLoginCode("5165550100")!;
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) checkLoginCode("5165550100", "000001");
    // Even the right code is refused now: the attacker must request a new one.
    expect(checkLoginCode("5165550100", code)).toEqual({ ok: false, reason: "too_many_attempts" });
  });

  it("rejects an expired code", () => {
    seedCustomer("cus_1", "5165550100");
    const { code } = issueLoginCode("5165550100", { ttlMinutes: -1 })!;
    expect(checkLoginCode("5165550100", code)).toEqual({ ok: false, reason: "expired" });
  });

  it("a new request replaces the previous code", () => {
    seedCustomer("cus_1", "5165550100");
    const first = issueLoginCode("5165550100")!;
    const second = issueLoginCode("5165550100")!;
    expect(checkLoginCode("5165550100", first.code).ok).toBe(false);
    expect(checkLoginCode("5165550100", second.code).ok).toBe(true);
  });

  it("never stores the code in the clear", () => {
    seedCustomer("cus_1", "5165550100");
    const { code } = issueLoginCode("5165550100")!;
    const rows = getDb().prepare("SELECT * FROM customer_login_codes").all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(code);
  });

  it("one customer's code does not work for another phone", () => {
    seedCustomer("cus_1", "5165550100");
    seedCustomer("cus_2", "5165550200");
    const { code } = issueLoginCode("5165550100")!;
    issueLoginCode("5165550200");
    expect(checkLoginCode("5165550200", code).ok).toBe(false);
  });
});
