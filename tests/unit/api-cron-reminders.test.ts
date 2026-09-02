import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import { dueReminders } from "@/lib/date-reminders";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSms(...a) }));
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => true,
  twilioDryRun: () => false,
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("CRON_SECRET", "s3cret");
  sendSms.mockReset();
  sendSms.mockResolvedValue({ sid: "SM1" });
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedDueCustomer(id = "1") {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, locale, messaging_channel, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, 'es', 'sms', ?, ?)`,
    )
    .run(id, "María Pérez", `516555${id.padStart(4, "0")}`, now, now);
  getDb()
    .prepare("INSERT INTO customer_tags (customer_id, tag) VALUES (?, 'sms-marketing')")
    .run(id);
  const target = new Date(Date.now() + 7 * 86400_000);
  addImportantDate(id, {
    kind: "birthday",
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
  });
}

async function post(auth?: string) {
  const { POST } = await import("@/app/api/cron/reminders/route");
  return POST(
    new Request("http://t", {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
    }),
  );
}

describe("POST /api/cron/reminders", () => {
  it("refuses a request with no credentials", async () => {
    seedDueCustomer();
    const res = await post();
    expect(res.status).toBe(401);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret", async () => {
    seedDueCustomer();
    expect((await post("Bearer wrong")).status).toBe(401);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("refuses to run at all when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    seedDueCustomer();
    const res = await post("Bearer anything");
    expect(res.status).toBe(503);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("texts a customer whose date is a week away", async () => {
    seedDueCustomer();
    const res = await post("Bearer s3cret");
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ due: 1, sent: 1, failed: 0 });
    expect(sendSms).toHaveBeenCalledTimes(1);
    const [, body] = sendSms.mock.calls[0];
    expect(body).toContain("María");
    expect(body.toUpperCase()).toContain("STOP");
  });

  it("does not text the same person twice when the cron runs again", async () => {
    seedDueCustomer();
    await post("Bearer s3cret");
    const second = await (await post("Bearer s3cret")).json();
    expect(second).toMatchObject({ due: 0, sent: 0 });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it("keeps going when one number fails", async () => {
    seedDueCustomer("1");
    seedDueCustomer("2");
    sendSms.mockRejectedValueOnce(new Error("bad number"));
    const data = await (await post("Bearer s3cret")).json();
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(1);
    // The one that failed stays due, so the next run retries it.
    expect(dueReminders({ leadDays: 7 }).length).toBe(1);
  });

  it("reports nothing to do on a quiet day", async () => {
    const data = await (await post("Bearer s3cret")).json();
    expect(data).toMatchObject({ due: 0, sent: 0, failed: 0 });
  });
});
