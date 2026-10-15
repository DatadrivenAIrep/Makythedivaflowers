import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

type Row = { product_id: string; visible: number };

/** Maky's explicit TV choices. A broken read means defaults, never a blank TV. */
export function getTvVisibility(): Map<string, boolean> {
  try {
    runMigrations();
    const rows = getDb().prepare("SELECT product_id, visible FROM tv_showcase_visibility").all() as Row[];
    return new Map(rows.map((r) => [r.product_id, r.visible === 1]));
  } catch (err) {
    console.error("[tv-showcase] visibility unavailable, using defaults", err);
    return new Map();
  }
}

export function setTvVisibility(productId: string, visible: boolean): void {
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO tv_showcase_visibility (product_id, visible, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(product_id) DO UPDATE
         SET visible = excluded.visible, updated_at = excluded.updated_at`,
    )
    .run(productId, visible ? 1 : 0, new Date().toISOString());
}
