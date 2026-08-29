import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

export type CampaignStatus = "draft" | "sending" | "sent";
export type CampaignSendStatus = "sent" | "failed" | "skipped" | "dry_run";

export type Campaign = {
  id: string;
  bodyEs: string;
  bodyEn: string;
  segment: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
};

type CampaignRow = {
  id: string;
  body_es: string;
  body_en: string;
  segment: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at: string | null;
};

function rowToCampaign(r: CampaignRow): Campaign {
  return {
    id: r.id,
    bodyEs: r.body_es,
    bodyEn: r.body_en,
    segment: r.segment,
    status: r.status as CampaignStatus,
    recipientCount: r.recipient_count,
    sentCount: r.sent_count,
    failedCount: r.failed_count,
    createdAt: r.created_at,
    sentAt: r.sent_at,
  };
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDraft(input: { bodyEs: string; bodyEn?: string; segment?: string }): Campaign {
  runMigrations();
  const id = newId("cmp");
  const createdAt = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO campaigns (id, body_es, body_en, segment, status, created_at)
       VALUES (?, ?, ?, ?, 'draft', ?)`,
    )
    .run(id, input.bodyEs, input.bodyEn ?? "", input.segment ?? "sms-marketing", createdAt);
  return getCampaign(id)!;
}

/**
 * Update a draft's bodies in place (guarded to `status='draft'`), so re-saving to
 * refresh the preview edits the same row instead of minting a new draft each time.
 * Returns the updated campaign, or null if the id isn't a draft (or doesn't exist).
 */
export function updateDraft(id: string, input: { bodyEs: string; bodyEn?: string }): Campaign | null {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE campaigns SET body_es = ?, body_en = ? WHERE id = ? AND status = 'draft'")
    .run(input.bodyEs, input.bodyEn ?? "", id);
  return res.changes === 1 ? getCampaign(id) : null;
}

export function getCampaign(id: string): Campaign | null {
  runMigrations();
  const row = getDb().prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as CampaignRow | undefined;
  return row ? rowToCampaign(row) : null;
}

export function listCampaigns(limit = 50): Campaign[] {
  runMigrations();
  // Tiebreak on rowid (SQLite's own monotonic insertion-order column), not id:
  // newId()'s trailing random suffix means id has no relation to insertion
  // order, and Date.now() resolution means created_at commonly ties between
  // rows created in the same synchronous call stack (matches the rowid
  // tiebreak already used in gift-card-storage.ts's listGiftCards).
  const rows = getDb()
    .prepare("SELECT * FROM campaigns ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(limit) as CampaignRow[];
  return rows.map(rowToCampaign);
}

/** Atomic guard: only a draft becomes sending. Returns false if it wasn't a draft. */
export function markSending(id: string): boolean {
  runMigrations();
  const res = getDb()
    .prepare("UPDATE campaigns SET status = 'sending' WHERE id = ? AND status = 'draft'")
    .run(id);
  return res.changes === 1;
}

export function recordSend(input: {
  campaignId: string;
  customerId: string;
  phone: string;
  status: CampaignSendStatus;
  providerSid?: string;
  error?: string;
}): void {
  runMigrations();
  getDb()
    .prepare(
      `INSERT INTO campaign_sends (id, campaign_id, customer_id, phone, status, provider_sid, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId("cs"),
      input.campaignId,
      input.customerId,
      input.phone,
      input.status,
      input.providerSid ?? null,
      input.error ?? null,
      new Date().toISOString(),
    );
}

export function finalizeCampaign(id: string, counts: { sent: number; failed: number }): void {
  runMigrations();
  getDb()
    .prepare(
      `UPDATE campaigns SET status = 'sent', sent_count = ?, failed_count = ?,
         recipient_count = ?, sent_at = ? WHERE id = ?`,
    )
    .run(counts.sent, counts.failed, counts.sent + counts.failed, new Date().toISOString(), id);
}
