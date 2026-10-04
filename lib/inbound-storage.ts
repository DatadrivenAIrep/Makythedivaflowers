import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

export type InboundMessage = {
  id: string;
  fromPhone: string;
  customerId?: string;
  body: string;
  providerSid?: string;
  createdAt: string;
  readAt?: string;
};

type Row = {
  id: string; from_phone: string; customer_id: string | null; body: string;
  provider_sid: string | null; created_at: string; read_at: string | null;
};

function toInbound(r: Row): InboundMessage {
  return {
    id: r.id,
    fromPhone: r.from_phone,
    customerId: r.customer_id ?? undefined,
    body: r.body,
    providerSid: r.provider_sid ?? undefined,
    createdAt: r.created_at,
    readAt: r.read_at ?? undefined,
  };
}

/**
 * `read: true` stores the message already read — used for STOP/START keywords,
 * which Twilio handles on its own and the shop never needs to be alerted about.
 */
export function insertInboundMessage(input: {
  fromPhone: string; customerId?: string; body: string; providerSid?: string; read?: boolean;
}): string {
  runMigrations();
  const id = `in_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO inbound_messages (id, from_phone, customer_id, body, provider_sid, created_at, read_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.fromPhone, input.customerId ?? null, input.body, input.providerSid ?? null, now, input.read ? now : null);
  return id;
}

export function listInboundMessages(limit = 500): InboundMessage[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM inbound_messages ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(limit) as Row[];
  return rows.map(toInbound);
}
