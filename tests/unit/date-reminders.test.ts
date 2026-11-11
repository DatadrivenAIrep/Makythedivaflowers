import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import {
  dueReminders,
  markReminderSent,
  recordReminder,
  hasOrderForWindow,
  hasRecentPaidOrder,
  renderReminder,
} from "@/lib/date-reminders";

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

  it("con DATE_REWARDS_ENABLED, quien solo aceptó promociones recibe el aviso", () => {
    vi.stubEnv("DATE_REWARDS_ENABLED", "1");
    seedCustomer("4", { channel: "none" });
    const { month, day } = monthDayIn(7);
    addImportantDate("4", { kind: "birthday", month, day });
    expect(dueReminders({ leadDays: 7, now: NOW })).toHaveLength(1);
  });

  it("sin la variable, todo sigue igual", () => {
    seedCustomer("4", { channel: "none" });
    const { month, day } = monthDayIn(7);
    addImportantDate("4", { kind: "birthday", month, day });
    expect(dueReminders({ leadDays: 7, now: NOW })).toHaveLength(0);
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

  it("names whose birthday it is when the date was saved for a recipient", () => {
    const es = renderReminder(
      { customerName: "Ana López", kind: "birthday", label: "Mamá Rosa", occurrenceDate: "2026-03-21" },
      "es",
    );
    expect(es).toContain("se acerca el cumpleaños de Mamá Rosa el 21 de marzo");
    const en = renderReminder(
      { customerName: "Ana López", kind: "anniversary", label: "Carlos", occurrenceDate: "2026-03-21" },
      "en",
    );
    expect(en).toContain("Carlos's anniversary is coming up on March 21");
  });

  it("carries the opt-out footer every marketing text needs", () => {
    const body = renderReminder(
      { customerName: "Ana", kind: "birthday", label: undefined, occurrenceDate: "2026-09-09" },
      "es",
    );
    expect(body.toUpperCase()).toContain("STOP");
  });
});

describe("etapa d3 y registro por etapa", () => {
  const rows = (): Array<{ stage: string; status: string; skip_reason: string | null }> =>
    getDb().prepare("SELECT stage, status, skip_reason FROM date_reminder_sends ORDER BY stage").all() as never;

  it("d3 solo trae cumpleaños y aniversarios, no fechas custom", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(3);
    addImportantDate("1", { kind: "birthday", month, day });
    addImportantDate("1", { kind: "anniversary", month, day });
    addImportantDate("1", { kind: "custom", month, day, label: "Otra" });
    const due = dueReminders({ leadDays: 3, stage: "d3", now: NOW });
    expect(due.map((d) => d.kind).sort()).toEqual(["anniversary", "birthday"]);
  });

  it("un d7 ya registrado no impide el d3", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(3);
    addImportantDate("1", { kind: "birthday", month, day });
    const [due] = dueReminders({ leadDays: 3, stage: "d3", now: NOW });
    markReminderSent(due.dateId, due.occurrenceDate);
    expect(dueReminders({ leadDays: 3, stage: "d3", now: NOW })).toHaveLength(1);
  });

  it("lo omitido o enviado en d3 deja de ser pendiente", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(3);
    addImportantDate("1", { kind: "birthday", month, day });
    const [due] = dueReminders({ leadDays: 3, stage: "d3", now: NOW });
    recordReminder(due.dateId, due.occurrenceDate, "d3", "skipped", "recent_order");
    expect(dueReminders({ leadDays: 3, stage: "d3", now: NOW })).toEqual([]);
    expect(rows()).toEqual([{ stage: "d3", status: "skipped", skip_reason: "recent_order" }]);
  });

  it("recordReminder guarda etapa, estado y motivo; markReminderSent es d7/sent", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(7);
    addImportantDate("1", { kind: "birthday", month, day });
    const [due] = dueReminders({ leadDays: 7, now: NOW });
    markReminderSent(due.dateId, due.occurrenceDate);
    expect(rows()).toEqual([{ stage: "d7", status: "sent", skip_reason: null }]);
  });

  it("con DATE_REWARDS_ENABLED excluye a quien ya respondió STOP; sin la variable no", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(7);
    addImportantDate("1", { kind: "birthday", month, day });
    getDb().prepare("UPDATE customers SET sms_stopped_at = ? WHERE id = '1'").run(NOW.toISOString());
    expect(dueReminders({ leadDays: 7, now: NOW })).toHaveLength(1);
    vi.stubEnv("DATE_REWARDS_ENABLED", "1");
    expect(dueReminders({ leadDays: 7, now: NOW })).toHaveLength(0);
  });
});

describe("hasRecentPaidOrder", () => {
  function order(id: string, customerId: string, o: { paid?: boolean; canceled?: boolean; at: string }) {
    getDb()
      .prepare(
        `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone, contact_phone,
           fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
           tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
         VALUES (?, 'es', 'walk-in', ?, 'R', '555', '555', 'delivery', '2026-06-01', '[]',
           0,0,0,0, ?, ?, ?, ?)`,
      )
      .run(id, customerId, o.canceled ? "canceled" : "pending", o.paid === false ? "unpaid" : "paid", o.at, o.at);
  }

  it("cuenta una compra pagada de los últimos 7 días", () => {
    seedCustomer("1");
    order("o1", "1", { at: "2026-08-30T12:00:00Z" });
    expect(hasRecentPaidOrder("1", NOW)).toBe(true);
  });
  it("no cuenta una vieja, una sin pagar ni una cancelada", () => {
    seedCustomer("1");
    order("o1", "1", { at: "2026-08-20T12:00:00Z" });
    order("o2", "1", { at: "2026-09-01T12:00:00Z", paid: false });
    order("o3", "1", { at: "2026-09-01T12:00:00Z", canceled: true });
    expect(hasRecentPaidOrder("1", NOW)).toBe(false);
  });
});

describe("hasOrderForWindow", () => {
  function order(id: string, o: { window: string | null; paid?: boolean; canceled?: boolean; customerId?: string }) {
    getDb()
      .prepare(
        `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone, contact_phone,
           fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
           tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
         VALUES (?, 'es', 'web', ?, 'R', '555', '555', 'delivery', ?, '[]',
           0,0,0,0, ?, ?, '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z')`,
      )
      .run(id, o.customerId ?? "1", o.window, o.canceled ? "canceled" : "pending", o.paid === false ? "pending" : "paid");
  }

  it("cuenta un pedido pagado con entrega entre hoy y la fecha, ambos incluidos", () => {
    seedCustomer("1");
    order("a", { window: "2026-09-02" });
    expect(hasOrderForWindow("1", "2026-09-02", "2026-09-05")).toBe(true);
    getDb().prepare("DELETE FROM orders").run();
    order("b", { window: "2026-09-05" });
    expect(hasOrderForWindow("1", "2026-09-02", "2026-09-05")).toBe(true);
  });

  it("no cuenta fuera del rango, sin pagar, cancelado, sin fecha ni de otro cliente", () => {
    seedCustomer("1");
    seedCustomer("2");
    order("antes", { window: "2026-09-01" });
    order("despues", { window: "2026-09-06" });
    order("sin-pagar", { window: "2026-09-03", paid: false });
    order("cancelado", { window: "2026-09-03", canceled: true });
    order("sin-fecha", { window: null });
    order("otro", { window: "2026-09-03", customerId: "2" });
    expect(hasOrderForWindow("1", "2026-09-02", "2026-09-05")).toBe(false);
  });
});

describe("dueReminders: origen de la fecha", () => {
  it("trae quién guardó la fecha", () => {
    seedCustomer("1");
    const { month, day } = monthDayIn(3);
    addImportantDate("1", { kind: "birthday", month, day, label: "Laura" });
    addImportantDate("1", { kind: "anniversary", month, day, label: "Sam", source: "customer" });
    const due = dueReminders({ leadDays: 3, stage: "d3", now: NOW });
    expect(due.map((d) => [d.label, d.source]).sort()).toEqual([
      ["Laura", "admin"],
      ["Sam", "customer"],
    ]);
  });
});
