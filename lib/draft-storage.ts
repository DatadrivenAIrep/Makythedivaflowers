import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { draftToRow, rowToDraft, rowToDraftDetail, type DraftInput, type DraftRow } from "@/lib/draft-row";
import type { OrderDraft, OrderDraftDetail } from "@/types/draft";

function ensureSchema(): void {
  runMigrations();
}

/** Upsert by id. created_at is preserved on conflict; updated_at always advances. */
export function saveDraft(input: DraftInput): OrderDraft {
  ensureSchema();
  const db = getDb();
  const row = draftToRow(input);
  db.prepare(
    `INSERT INTO order_drafts (
       id, label, payload_json, item_count, total_cents, taken_by, created_at, updated_at
     ) VALUES (
       @id, @label, @payload_json, @item_count, @total_cents, @taken_by, @created_at, @updated_at
     )
     ON CONFLICT(id) DO UPDATE SET
       label=excluded.label,
       payload_json=excluded.payload_json,
       item_count=excluded.item_count,
       total_cents=excluded.total_cents,
       updated_at=excluded.updated_at`,
  ).run(row);
  const stored = db.prepare("SELECT * FROM order_drafts WHERE id = ?").get(input.id) as DraftRow;
  return rowToDraft(stored);
}

export function listDrafts(): OrderDraft[] {
  ensureSchema();
  const rows = getDb()
    .prepare("SELECT * FROM order_drafts ORDER BY updated_at DESC, id DESC")
    .all() as DraftRow[];
  return rows.map(rowToDraft);
}

export function getDraft(id: string): OrderDraftDetail | null {
  ensureSchema();
  const row = getDb().prepare("SELECT * FROM order_drafts WHERE id = ?").get(id) as DraftRow | undefined;
  return row ? rowToDraftDetail(row) : null;
}

export function deleteDraft(id: string): void {
  ensureSchema();
  getDb().prepare("DELETE FROM order_drafts WHERE id = ?").run(id);
}
