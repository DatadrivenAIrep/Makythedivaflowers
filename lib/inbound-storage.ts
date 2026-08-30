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
};

type Row = { id: string; from_phone: string; customer_id: string | null; body: string; provider_sid: string | null; created_at: string };

function toInbound(r: Row): InboundMessage {
  return {
    id: r.id,
    fromPhone: r.from_phone,
    customerId: r.customer_id ?? undefined,
    body: r.body,
    providerSid: r.provider_sid ?? undefined,
    createdAt: r.created_at,
  };
}

export function insertInboundMessage(input: {
  fromPhone: string; customerId?: string; body: string; providerSid?: string;
}): string {
  runMigrations();
  const id = `in_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  getDb()
    .prepare(
      `INSERT INTO inbound_messages (id, from_phone, customer_id, body, provider_sid, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.fromPhone, input.customerId ?? null, input.body, input.providerSid ?? null, new Date().toISOString());
  return id;
}

export function listInboundMessages(limit = 500): InboundMessage[] {
  runMigrations();
  const rows = getDb()
    .prepare("SELECT * FROM inbound_messages ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(limit) as Row[];
  return rows.map(toInbound);
}
