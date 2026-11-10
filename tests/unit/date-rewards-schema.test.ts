import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { applyMigrationsUpTo } from "../helpers/migrate-up-to";
import { dateRewardsEnabled, d3RemindersEnabled } from "@/lib/date-rewards-flags";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seedCustomer(id: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, locale, messaging_channel, first_seen_at, last_seen_at)
       VALUES (?, 'C', '5165550000', 'es', 'sms', ?, ?)`,
    )
    .run(id, now, now);
}

describe("migration 042", () => {
  it("pasa los avisos ya enviados como d7/sent", () => {
    const db = getDb();
    applyMigrationsUpTo(db, "041_loyalty_card.sql");
    db.prepare(
      "INSERT INTO date_reminder_sends (date_id, occurrence_date, sent_at) VALUES ('cid_1', '2026-12-01', '2026-11-24T14:15:00Z')",
    ).run();
    runMigrations();
    expect(
      db
        .prepare(
          "SELECT date_id, occurrence_date, stage, status, skip_reason, recorded_at FROM date_reminder_sends",
        )
        .all(),
    ).toEqual([
      {
        date_id: "cid_1",
        occurrence_date: "2026-12-01",
        stage: "d7",
        status: "sent",
        skip_reason: null,
        recorded_at: "2026-11-24T14:15:00Z",
      },
    ]);
  });

  it("permite d3 y d7 de la misma fecha y año", () => {
    runMigrations();
    const db = getDb();
    const ins = db.prepare(
      "INSERT INTO date_reminder_sends (date_id, occurrence_date, stage, status, recorded_at) VALUES ('c', '2026-12-01', ?, 'sent', 'x')",
    );
    ins.run("d7");
    ins.run("d3");
    expect(db.prepare("SELECT COUNT(*) AS n FROM date_reminder_sends").get()).toEqual({ n: 2 });
    expect(() => ins.run("d3")).toThrow();
  });

  it("las fechas existentes quedan con source 'admin'", () => {
    const db = getDb();
    applyMigrationsUpTo(db, "041_loyalty_card.sql");
    seedCustomer("cu1");
    db.prepare(
      "INSERT INTO customer_important_dates (id, customer_id, kind, month, day, created_at) VALUES ('d1', 'cu1', 'birthday', 5, 6, 'now')",
    ).run();
    runMigrations();
    expect(db.prepare("SELECT source FROM customer_important_dates WHERE id = 'd1'").get()).toEqual({
      source: "admin",
    });
  });

  it("date_prompt_answers admite una sola respuesta por pedido", () => {
    runMigrations();
    const ins = getDb().prepare(
      "INSERT INTO date_prompt_answers (order_id, answer, created_at) VALUES ('o1', ?, 'now')",
    );
    ins.run("date");
    expect(() => ins.run("likes")).toThrow();
  });
});

describe("flags", () => {
  it("las variables están apagadas por defecto", () => {
    vi.stubEnv("DATE_REWARDS_ENABLED", "");
    vi.stubEnv("DATE_REMINDER_D3_ENABLED", "");
    expect(dateRewardsEnabled()).toBe(false);
    expect(d3RemindersEnabled()).toBe(false);
    for (const v of ["1", "true"]) {
      vi.stubEnv("DATE_REWARDS_ENABLED", v);
      vi.stubEnv("DATE_REMINDER_D3_ENABLED", v);
      expect(dateRewardsEnabled()).toBe(true);
      expect(d3RemindersEnabled()).toBe(true);
    }
    vi.stubEnv("DATE_REWARDS_ENABLED", "yes");
    vi.stubEnv("DATE_REMINDER_D3_ENABLED", "yes");
    expect(dateRewardsEnabled()).toBe(false);
    expect(d3RemindersEnabled()).toBe(false);
  });
});
