import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { verifyCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth";
import { __resetRateLimitForTests } from "@/lib/rate-limit";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => true,
  twilioDryRun: () => false,
}));

const SECRET = "b".repeat(48);

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("INTAKE_SESSION_SECRET", SECRET);
  sendSms.mockReset();
  sendSms.mockResolvedValue({ sid: "SM1" });
  __resetRateLimitForTests();
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedCustomer(id = "cus_1", phone = "5165550100") {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, first_seen_at, last_seen_at)
       VALUES (?, 'María Pérez', ?, ?, ?)`,
    )
    .run(id, phone, now, now);
}

async function requestCode(phone: string, ip = "1.1.1.1") {
  const { POST } = await import("@/app/api/account/request-code/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ phone }),
    }),
  );
}

async function verify(phone: string, code: string, ip = "1.1.1.1") {
  const { POST } = await import("@/app/api/account/verify/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ phone, code }),
    }),
  );
}

/** The six digits the SMS actually carried. */
function sentCode(): string {
  const [, body] = sendSms.mock.calls[0];
  return (body as string).match(/\d{6}/)![0];
}

describe("POST /api/account/request-code", () => {
  it("texts a code to a known customer", async () => {
    seedCustomer();
    const res = await requestCode("5165550100");
    expect(res.status).toBe(200);
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(sentCode()).toMatch(/^\d{6}$/);
  });

  it("answers a stranger exactly as it answers a customer", async () => {
    seedCustomer();
    const known = await requestCode("5165550100");
    sendSms.mockClear();
    __resetRateLimitForTests();
    const unknown = await requestCode("5169999999");

    // Same status and same body: this endpoint must not become a way to ask
    // whether a phone number shops here.
    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("rejects something that is not a phone number", async () => {
    expect((await requestCode("123")).status).toBe(400);
  });

  it("stops someone hammering one number", async () => {
    seedCustomer();
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await requestCode("5165550100")).status);
    expect(codes).toContain(429);
  });
});

describe("POST /api/account/verify", () => {
  it("signs the customer in and sets a session cookie", async () => {
    seedCustomer();
    await requestCode("5165550100");
    const res = await verify("5165550100", sentCode());
    expect(res.status).toBe(200);

    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(CUSTOMER_SESSION_COOKIE);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    const token = cookie.match(new RegExp(`${CUSTOMER_SESSION_COOKIE}=([^;]+)`))![1];
    expect(verifyCustomerSession(decodeURIComponent(token))).toBe("cus_1");
  });

  it("refuses a wrong code without setting a cookie", async () => {
    seedCustomer();
    await requestCode("5165550100");
    const res = await verify("5165550100", "000000");
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("refuses a code for a phone that never asked for one", async () => {
    seedCustomer();
    expect((await verify("5165550100", "123456")).status).toBe(401);
  });

  it("stops someone brute-forcing the six digits", async () => {
    seedCustomer();
    await requestCode("5165550100");
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await verify("5165550100", "000001")).status);
    expect(statuses).toContain(429);
  });
});

describe("POST /api/account/sign-out", () => {
  it("clears the session cookie", async () => {
    const { POST } = await import("@/app/api/account/sign-out/route");
    const res = await POST();
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(CUSTOMER_SESSION_COOKIE);
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
