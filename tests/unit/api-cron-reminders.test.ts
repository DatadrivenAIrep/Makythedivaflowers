import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { addImportantDate } from "@/lib/customer-dates-storage";
import { dueReminders } from "@/lib/date-reminders";
import * as sale from "@/lib/date-sale-message";

const sendSms = vi.fn();
vi.mock("@/lib/twilio-server", () => ({
  sendSms: (...a: unknown[]) => sendSms(...a),
  e164: (p: string) => `+1${p.replace(/\D/g, "")}`,
}));
const lookupCustomer = vi.fn();
vi.mock("@/lib/loyalty-client", () => ({
  loyaltyEnabled: () => true,
  lookupCustomer: (...a: unknown[]) => lookupCustomer(...a),
}));
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => true,
  twilioDryRun: () => false,
}));

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("CRON_SECRET", "s3cret");
  sendSms.mockReset();
  sendSms.mockResolvedValue({ sid: "SM1" });
  lookupCustomer.mockReset();
  lookupCustomer.mockResolvedValue({
    id: 1,
    cardUrl: "x",
    rewards: { available: [{ id: "r1", reward: "10% de descuento", final: false }, { id: "r2", reward: "15% de descuento", final: false }] },
  });
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedDueCustomer(id = "1", days = 7, kind: "birthday" | "anniversary" | "custom" = "birthday") {
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
  const target = new Date(Date.now() + days * 86400_000);
  addImportantDate(id, {
    kind,
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate(),
    ...(kind === "custom" ? { label: "Otra" } : { label: "Laura" }),
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

  describe("registro y etapa d3", () => {
    const sends = (): Array<{ stage: string; status: string; skip_reason: string | null }> =>
      getDb().prepare("SELECT stage, status, skip_reason FROM date_reminder_sends ORDER BY stage, status").all() as never;

    it("responde siempre con skipped", async () => {
      const data = await (await post("Bearer s3cret")).json();
      expect(data).toEqual({ due: 0, sent: 0, failed: 0, skipped: 0, dryRun: false });
    });

    it("sin DATE_REMINDER_D3_ENABLED solo sale d7", async () => {
      seedDueCustomer("1", 3);
      const data = await (await post("Bearer s3cret")).json();
      expect(data.due).toBe(0);
      expect(sendSms).not.toHaveBeenCalled();
    });

    it("con ambas banderas apagadas no hay tope diario: dos fechas d7, dos textos", async () => {
      seedDueCustomer("1");
      addImportantDate("1", { kind: "anniversary", month: new Date(Date.now() + 7 * 86400_000).getUTCMonth() + 1, day: new Date(Date.now() + 7 * 86400_000).getUTCDate() });
      const data = await (await post("Bearer s3cret")).json();
      expect(data).toMatchObject({ sent: 2, skipped: 0 });
    });

    it("d3 manda el texto de venta con el mejor descuento y lo registra", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      seedDueCustomer("1", 3);
      const data = await (await post("Bearer s3cret")).json();
      expect(data).toMatchObject({ due: 1, sent: 1, failed: 0, skipped: 0 });
      const [, body] = sendSms.mock.calls[0];
      expect(body).toContain("en 3 días es el cumpleaños de Laura");
      expect(body).toContain("15%");
      expect(lookupCustomer.mock.calls[0][1]).toEqual({ timeoutMs: 5000 });
      expect(sends()).toEqual([{ stage: "d3", status: "sent", skip_reason: null }]);
    });

    it("si la tarjeta falla, sale sin premio", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      lookupCustomer.mockRejectedValue(new Error("boom"));
      seedDueCustomer("1", 3);
      const data = await (await post("Bearer s3cret")).json();
      expect(data.sent).toBe(1);
      expect(sendSms.mock.calls[0][1]).not.toContain("%");
    });

    it("d3 omitido por compra reciente", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      seedDueCustomer("1", 3);
      const at = new Date(Date.now() - 86400_000).toISOString();
      getDb()
        .prepare(
          `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone, contact_phone,
             fulfillment_method, window_date, lines_json, subtotal_cents, delivery_cents,
             tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
           VALUES ('o1', 'es', 'walk-in', '1', 'R', '555', '555', 'delivery', '2026-06-01', '[]',
             0,0,0,0, 'pending', 'paid', ?, ?)`,
        )
        .run(at, at);
      const data = await (await post("Bearer s3cret")).json();
      expect(data).toMatchObject({ sent: 0, skipped: 1 });
      expect(sendSms).not.toHaveBeenCalled();
      expect(sends()).toEqual([{ stage: "d3", status: "skipped", skip_reason: "recent_order" }]);
    });

    it("un solo SMS por cliente al día; va primero d3", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      seedDueCustomer("1", 3);
      const d7 = new Date(Date.now() + 7 * 86400_000);
      addImportantDate("1", { kind: "birthday", month: d7.getUTCMonth() + 1, day: d7.getUTCDate(), label: "Ana" });
      const data = await (await post("Bearer s3cret")).json();
      expect(data).toMatchObject({ sent: 1, skipped: 1 });
      expect(sendSms).toHaveBeenCalledTimes(1);
      expect(sendSms.mock.calls[0][1]).toContain("en 3 días");
      expect(sends()).toEqual([
        { stage: "d3", status: "sent", skip_reason: null },
        { stage: "d7", status: "skipped", skip_reason: "daily_cap" },
      ]);
    });

    it("el tope diario también aplica con solo DATE_REWARDS_ENABLED", async () => {
      vi.stubEnv("DATE_REWARDS_ENABLED", "1");
      seedDueCustomer("1");
      const d7 = new Date(Date.now() + 7 * 86400_000);
      addImportantDate("1", { kind: "anniversary", month: d7.getUTCMonth() + 1, day: d7.getUTCDate() });
      const data = await (await post("Bearer s3cret")).json();
      expect(data).toMatchObject({ sent: 1, skipped: 1 });
    });

    it("d3 no se envía para fechas custom", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      seedDueCustomer("1", 3, "custom");
      const data = await (await post("Bearer s3cret")).json();
      expect(data.due).toBe(0);
      expect(sendSms).not.toHaveBeenCalled();
    });

    it("un d7 ya registrado no impide el d3", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      seedDueCustomer("1", 3);
      const [row] = getDb().prepare("SELECT id FROM customer_important_dates").all() as Array<{ id: string }>;
      const occ = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
      getDb()
        .prepare("INSERT INTO date_reminder_sends (date_id, occurrence_date, stage, status, recorded_at) VALUES (?, ?, 'd7', 'sent', ?)")
        .run(row.id, occ, new Date().toISOString());
      const data = await (await post("Bearer s3cret")).json();
      expect(data.sent).toBe(1);
    });

    it("21610 marca STOP, quita la etiqueta y se registra omitido sin contar como fallo", async () => {
      seedDueCustomer("1");
      sendSms.mockRejectedValueOnce(Object.assign(new Error("unsub"), { code: 21610 }));
      const data = await (await post("Bearer s3cret")).json();
      expect(data).toMatchObject({ sent: 0, failed: 0, skipped: 1 });
      const c = getDb().prepare("SELECT messaging_channel, sms_stopped_at FROM customers WHERE id = '1'").get() as { messaging_channel: string; sms_stopped_at: string | null };
      expect(c.messaging_channel).toBe("none");
      expect(c.sms_stopped_at).toBeTruthy();
      expect(getDb().prepare("SELECT 1 FROM customer_tags WHERE customer_id = '1' AND tag = 'sms-marketing'").get()).toBeUndefined();
      expect(sends()).toEqual([{ stage: "d7", status: "skipped", skip_reason: "21610" }]);
    });

    it("un fallo en el d3 de un cliente no impide el d7 de otro", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      seedDueCustomer("1", 3);
      seedDueCustomer("2", 7);
      const spy = vi.spyOn(sale, "renderSaleReminder").mockImplementation(() => {
        throw new Error("boom");
      });
      const data = await (await post("Bearer s3cret")).json();
      spy.mockRestore();
      expect(data).toMatchObject({ sent: 1, failed: 1 });
      expect(sendSms).toHaveBeenCalledTimes(1);
      expect(sends()).toEqual([{ stage: "d7", status: "sent", skip_reason: null }]);
    });

    it("si falla la consulta de la tarjeta, deja rastro sin teléfono ni mensaje", async () => {
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", "1");
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      lookupCustomer.mockRejectedValue(Object.assign(new Error("fail for +15165550001"), { code: "unavailable" }));
      seedDueCustomer("1", 3);
      await post("Bearer s3cret");
      expect(warn).toHaveBeenCalledWith("[reminders] card lookup failed", "unavailable");
      expect(JSON.stringify(warn.mock.calls)).not.toContain("5165550001");
      warn.mockRestore();
    });
  });
});
