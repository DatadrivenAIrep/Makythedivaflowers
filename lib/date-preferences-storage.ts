import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { withTransaction } from "@/lib/db-tx";
import {
  AVOID, COLORS, FLOWERS,
  type AvoidCode, type ColorCode, type FlowerCode,
} from "@/lib/date-preference-options";

export type DatePreferences = { flowers: FlowerCode[]; colors: ColorCode[]; avoid: AvoidCode[] };

const MAX_PICKS = 3;

type Kind = "favorite_flower" | "favorite_color" | "avoid";

function empty(): DatePreferences {
  return { flowers: [], colors: [], avoid: [] };
}

export function getDatePreferences(dateId: string): DatePreferences {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT kind, value FROM date_preferences WHERE date_id = ? ORDER BY rowid")
    .all(dateId) as Array<{ kind: Kind; value: string }>;
  const out = empty();
  for (const r of rows) {
    if (r.kind === "favorite_flower") out.flowers.push(r.value as FlowerCode);
    else if (r.kind === "favorite_color") out.colors.push(r.value as ColorCode);
    else if (r.kind === "avoid") out.avoid.push(r.value as AvoidCode);
  }
  return out;
}

/** Keeps known codes only, without repeats, in the order received. */
function clean<T extends string>(values: readonly string[], allowed: readonly T[], max = Infinity): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of values) {
    if (!(allowed as readonly string[]).includes(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v as T);
  }
  return out.slice(0, max);
}

/** Replaces all likes of a date. Unknown codes and repeats are dropped; flowers and colors keep the first 3. */
export function setDatePreferences(dateId: string, prefs: DatePreferences): DatePreferences {
  runMigrations();
  const next: DatePreferences = {
    flowers: clean(prefs.flowers, FLOWERS, MAX_PICKS),
    colors: clean(prefs.colors, COLORS, MAX_PICKS),
    avoid: clean(prefs.avoid, AVOID),
  };
  const db = getDb();
  const insert = db.prepare("INSERT INTO date_preferences (date_id, kind, value) VALUES (?, ?, ?)");
  withTransaction(() => {
    db.prepare("DELETE FROM date_preferences WHERE date_id = ?").run(dateId);
    for (const v of next.flowers) insert.run(dateId, "favorite_flower", v);
    for (const v of next.colors) insert.run(dateId, "favorite_color", v);
    for (const v of next.avoid) insert.run(dateId, "avoid", v);
  });
  return next;
}

/** Likes of the most recent date of this person that has any; null when none. */
export function preferencesForRecipient(
  customerId: string,
  who: { name: string; phone?: string },
): DatePreferences | null {
  runMigrations();
  const phone = (who.phone ?? "").replace(/\D/g, "").slice(-10);
  const name = who.name.trim().toLowerCase();
  const rows = getDb()
    .prepare(
      `SELECT id, label, recipient_phone FROM customer_important_dates
       WHERE customer_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(customerId) as Array<{ id: string; label: string | null; recipient_phone: string | null }>;
  for (const r of rows) {
    const same =
      (phone.length === 10 && r.recipient_phone === phone) ||
      (name !== "" && (r.label ?? "").trim().toLowerCase() === name);
    if (!same) continue;
    const prefs = getDatePreferences(r.id);
    if (prefs.flowers.length || prefs.colors.length || prefs.avoid.length) return prefs;
  }
  return null;
}
