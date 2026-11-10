import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  smsPermission, grantPromoConsent, revokePromoConsent, markSmsStopped, clearSmsStopped,
  PROMO_CONSENT_TEXT_VERSION,
} from "@/lib/promo-consent";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, locale, messaging_channel, first_seen_at, last_seen_at)
       VALUES ('c1', 'Ana', '5165550001', 'es', 'sms', ?, ?)`,
    )
    .run(now, now);
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const tags = () =>
  (getDb().prepare("SELECT tag FROM customer_tags WHERE customer_id = 'c1'").all() as { tag: string }[]).map((t) => t.tag);
const logRows = () =>
  getDb().prepare("SELECT * FROM marketing_consent_log WHERE customer_id = 'c1'").all() as Array<Record<string, unknown>>;
const channel = () =>
  (getDb().prepare("SELECT messaging_channel AS m FROM customers WHERE id = 'c1'").get() as { m: string }).m;

describe("promo consent", () => {
  it("starts as none", () => {
    expect(smsPermission("c1")).toBe("none");
  });

  it("grant agrega la etiqueta y deja constancia", () => {
    expect(grantPromoConsent("c1", { source: "date_prompt", ip: "1.2.3.4" })).toBe("granted");
    expect(smsPermission("c1")).toBe("granted");
    expect(tags()).toContain("sms-marketing");
    const rows = logRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "grant", source: "date_prompt", ip: "1.2.3.4", text_version: "2026-11-09",
    });
    expect(PROMO_CONSENT_TEXT_VERSION).toBe("2026-11-09");
  });

  it("grant no toca messaging_channel", () => {
    getDb().prepare("UPDATE customers SET messaging_channel = 'none' WHERE id = 'c1'").run();
    grantPromoConsent("c1", { source: "account", ip: "1.2.3.4" });
    expect(channel()).toBe("none");
  });

  it("grant con STOP no hace nada", () => {
    markSmsStopped("c1");
    expect(grantPromoConsent("c1", { source: "date_prompt", ip: "1.2.3.4" })).toBe("stopped");
    expect(smsPermission("c1")).toBe("stopped");
    expect(tags()).not.toContain("sms-marketing");
    expect(logRows()).toHaveLength(0);
  });

  it("revoke quita la etiqueta y registra", () => {
    grantPromoConsent("c1", { source: "date_prompt", ip: "1.2.3.4" });
    revokePromoConsent("c1", { source: "account", ip: "5.6.7.8" });
    expect(smsPermission("c1")).toBe("none");
    const rows = logRows();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ action: "revoke", source: "account", ip: "5.6.7.8" });
  });

  it("markSmsStopped / clearSmsStopped", () => {
    markSmsStopped("c1", new Date("2026-11-09T10:00:00Z"));
    const r = getDb().prepare("SELECT sms_stopped_at AS s FROM customers WHERE id = 'c1'").get() as { s: string };
    expect(r.s).toBe("2026-11-09T10:00:00.000Z");
    clearSmsStopped("c1");
    expect(smsPermission("c1")).toBe("none");
  });
});
