import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

describe("014_inquiries migration", () => {
  it("creates inquiries with the expected columns", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO inquiries (id, type, stage, contact_name, contact_email, contact_phone,
         budget_band, event_date, venue, guests, company, frequency, vibe, notes,
         follow_up_date, lost_reason, source_channel, locale, acknowledged_at, created_at, updated_at)
       VALUES ('iq1','wedding','nuevo','Ana','ana@x.com','5551','10-25k','2027-06-01','Glen Cove',120,
         NULL,NULL,'romantic garden',NULL,NULL,NULL,'web','es',NULL,'2026-07-04T00:00:00Z','2026-07-04T00:00:00Z')`,
    ).run();
    const row = db.prepare("SELECT * FROM inquiries WHERE id = 'iq1'").get() as {
      type: string; stage: string; contact_name: string; budget_band: string; guests: number;
    };
    expect(row.type).toBe("wedding");
    expect(row.stage).toBe("nuevo");
    expect(row.contact_name).toBe("Ana");
    expect(row.budget_band).toBe("10-25k");
    expect(row.guests).toBe(120);
  });

  it("creates inquiry_changes audit table", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO inquiries (id, type, stage, contact_name, contact_email, contact_phone,
         source_channel, created_at, updated_at)
       VALUES ('iq1','event','nuevo','Bob','b@x.com','5552','manual','2026-07-04T00:00:00Z','2026-07-04T00:00:00Z')`,
    ).run();
    db.prepare(
      `INSERT INTO inquiry_changes (id, inquiry_id, at, actor, kind, summary)
       VALUES ('c1','iq1','2026-07-04T00:00:00Z','maky','created','Lead creado')`,
    ).run();
    const rows = db.prepare("SELECT summary FROM inquiry_changes WHERE inquiry_id='iq1'").all();
    expect(rows).toEqual([{ summary: "Lead creado" }]);
  });
});
