import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import { dueReminders, markReminderSent, renderReminder } from "@/lib/date-reminders";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const NOW = new Date("2026-09-02T12:00:00Z");

function seedCustomer(id: string, opts: { marketing?: boolean; channel?: string } = {}) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, locale, messaging_channel, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, 'es', ?, ?, ?)`,
    )
    .run(id, `Cliente ${id}`, `516555${id.padStart(4, "0")}`, opts.channel ?? "sms", now, now);
  if (opts.marketing !== false) {
    getDb()
      .prepare("INSERT INTO customer_tags (customer_id, tag) VALUES (?, 'sms-marketing')")
      .run(id);
  }
}

/** A date `days` from NOW, as month/day. */
function monthDayIn(days: number) {
  const d = new Date(NOW.getTime() + days * 86400_000);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

describe("dueReminders", () => {
  it("finds a date exactly the lead time away", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(7);
    addImportantDate("1", { kind: "birthday", month, day });
    const due = dueReminders({ leadDays: 7, now: NOW });
    expect(due).toHaveLength(1);
    expect(due[0].customerId).toBe("1");
  });

  it("ignores a date that is nearer or further than the lead time", () => {
    seedCustomer("1");
    const near = monthDayIn(3);
    const far = monthDayIn(20);
    addImportantDate("1", { kind: "birthday", month: near.month, day: near.day });
    addImportantDate("1", { kind: "anniversary", month: far.month, day: far.day });
    expect(dueReminders({ leadDays: 7, now: NOW })).toEqual([]);
  });

  it("skips a customer who never opted in to marketing texts", () => {
    seedCustomer("2", { marketing: false });
    const { month, day } = monthDayIn(7);
    addImportantDate("2", { kind: "birthday", month, day });
    expect(dueReminders({ leadDays: 7, now: NOW })).toEqual([]);
  });

  it("skips a customer who asked for no messages at all", () => {
    seedCustomer("3", { channel: "none" });
    const { month, day } = monthDayIn(7);
    addImportantDate("3", { kind: "birthday", month, day });
    expect(dueReminders({ leadDays: 7, now: NOW })).toEqual([]);
  });

  it("does not repeat once sent for that occurrence", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(7);
    const d = addImportantDate("1", { kind: "birthday", month, day });
    const [due] = dueReminders({ leadDays: 7, now: NOW });
    markReminderSent(due.dateId, due.occurrenceDate);
    expect(dueReminders({ leadDays: 7, now: NOW })).toEqual([]);
    expect(d).toBeTruthy();
  });

  it("sends again for next year's occurrence", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(7);
    addImportantDate("1", { kind: "birthday", month, day });
    const [due] = dueReminders({ leadDays: 7, now: NOW });
    markReminderSent(due.dateId, due.occurrenceDate);

    const nextYear = new Date(NOW.getTime() + 365 * 86400_000);
    expect(dueReminders({ leadDays: 7, now: nextYear }).length).toBe(1);
  });

  it("marking twice is harmless", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(7);
    addImportantDate("1", { kind: "birthday", month, day });
    const [due] = dueReminders({ leadDays: 7, now: NOW });
    markReminderSent(due.dateId, due.occurrenceDate);
    expect(() => markReminderSent(due.dateId, due.occurrenceDate)).not.toThrow();
  });
});

describe("renderReminder", () => {
  it("greets by first name and names the occasion", () => {
    const body = renderReminder(
      { customerName: "María Pérez", kind: "birthday", label: undefined, occurrenceDate: "2026-09-09" },
      "es",
    );
    expect(body).toContain("María");
    expect(body.length).toBeGreaterThan(20);
  });

  it("works without a name", () => {
    const body = renderReminder(
      { customerName: "", kind: "anniversary", label: undefined, occurrenceDate: "2026-09-09" },
      "es",
    );
    expect(body).not.toContain("undefined");
    expect(body).not.toMatch(/\s{2,}/);
  });

  it("uses a custom date's own label", () => {
    const body = renderReminder(
      { customerName: "Ana", kind: "custom", label: "Aniversario de bodas de mis papás", occurrenceDate: "2026-09-09" },
      "es",
    );
    expect(body).toContain("Aniversario de bodas de mis papás");
  });

  it("carries the opt-out footer every marketing text needs", () => {
    const body = renderReminder(
      { customerName: "Ana", kind: "birthday", label: undefined, occurrenceDate: "2026-09-09" },
      "es",
    );
    expect(body.toUpperCase()).toContain("STOP");
  });
});
