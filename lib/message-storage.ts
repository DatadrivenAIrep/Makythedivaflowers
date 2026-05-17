import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

export type MessageChannel = "sms" | "whatsapp" | "email";
export type MessageTemplate = "order_received" | "payment_link" | "payment_confirmed";
export type MessageStatus = "queued" | "sent" | "failed" | "skipped";

export type Message = {
  id: string;
  orderId: string;
  customerId?: string;
  channel: MessageChannel;
  template: MessageTemplate;
  locale: "en" | "es";
  toPhone?: string;
  toEmail?: string;
  providerSid?: string;
  status: MessageStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type InsertInput = Omit<Message, "id" | "status" | "createdAt" | "updatedAt" | "providerSid" | "error">;

type MessageRow = {
  id: string;
  order_id: string;
  customer_id: string | null;
  channel: string;
  template: string;
  locale: string;
  to_phone: string | null;
  to_email: string | null;
  provider_sid: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    orderId: r.order_id,
    customerId: r.customer_id ?? undefined,
    channel: r.channel as MessageChannel,
    template: r.template as MessageTemplate,
    locale: r.locale as "en" | "es",
    toPhone: r.to_phone ?? undefined,
    toEmail: r.to_email ?? undefined,
    providerSid: r.provider_sid ?? undefined,
    status: r.status as MessageStatus,
    error: r.error ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function newId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function insertMessage(input: InsertInput): string {
  runMigrations();
  const id = newId();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO messages
         (id, order_id, customer_id, channel, template, locale, to_phone, to_email, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    )
    .run(
      id,
      input.orderId,
      input.customerId ?? null,
      input.channel,
      input.template,
      input.locale,
      input.toPhone ?? null,
      input.toEmail ?? null,
      now,
      now,
    );
  return id;
}

export type UpdateInput = {
  status: MessageStatus;
  providerSid?: string;
  error?: string;
};

export function updateMessage(id: string, patch: UpdateInput): void {
  runMigrations();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE messages SET status = ?, provider_sid = COALESCE(?, provider_sid), error = ?, updated_at = ? WHERE id = ?`,
    )
    .run(patch.status, patch.providerSid ?? null, patch.error ?? null, now, id);
}

export function recentMessagesForOrder(orderId: string, limit: number): Message[] {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT * FROM messages WHERE order_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(orderId, limit) as MessageRow[];
  return rows.map(rowToMessage);
}

export function hasRecentSuccess(
  orderId: string,
  template: MessageTemplate,
  hoursAgo: number,
): boolean {
  runMigrations();
  const cutoff = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  const row = getDb()
    .prepare(
      `SELECT id FROM messages
       WHERE order_id = ? AND template = ? AND status = 'sent' AND created_at > ?
       LIMIT 1`,
    )
    .get(orderId, template, cutoff) as { id: string } | undefined;
  return !!row;
}
