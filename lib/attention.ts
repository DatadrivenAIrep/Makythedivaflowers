import "server-only";
import { getPendingQueue } from "@/lib/order-queue";
import { listUnacknowledged, type Inquiry } from "@/lib/inquiry-storage-db";
import { listUnreadConversations } from "@/lib/conversation-storage";
import type { Order } from "@/types/order";

export type AttentionKind = "order" | "inquiry" | "contact" | "sms";

export type AttentionItem = {
  kind: AttentionKind;
  id: string;
  createdAt: string;
  label: string;
  reason?: string; // order PendingReason, when kind === "order"
  // kind === "sms" only:
  preview?: string; // newest unread reply
  count?: number; // unread replies in the conversation
  conversationKey?: string; // opens /admin/messages?c=<key>
};

export type AttentionSnapshot = {
  items: AttentionItem[]; // newest first
  counts: { orders: number; inquiries: number; contacts: number; sms: number; total: number };
  generatedAt: string;
};

const SOURCE_LABEL_ES: Record<string, string> = {
  web: "Orden web",
  phone: "Orden teléfono",
  whatsapp: "Orden WhatsApp",
  "walk-in": "Orden en tienda",
  event: "Orden evento",
};

function orderLabel(o: Order): string {
  const src = SOURCE_LABEL_ES[o.source] ?? "Orden";
  return `${src} · ${o.fulfillment.recipient.name}`;
}

function inquiryLabel(i: Inquiry): string {
  const prefix = i.type === "wedding" ? "Boda" : i.type === "event" ? "Evento" : "Contacto";
  return `${prefix} · ${i.contactName}`;
}

export async function getAttention(): Promise<AttentionSnapshot> {
  const queue = await getPendingQueue();
  const inquiries = listUnacknowledged(["wedding", "event"]);
  const contacts = listUnacknowledged(["contact"]);

  const orderItems: AttentionItem[] = queue.map((q) => ({
    kind: "order",
    id: q.orderId,
    createdAt: q.order.createdAt,
    label: orderLabel(q.order),
    reason: q.reason,
  }));
  const inquiryItems: AttentionItem[] = inquiries.map((i) => ({
    kind: "inquiry",
    id: i.id,
    createdAt: i.createdAt,
    label: inquiryLabel(i),
  }));
  const contactItems: AttentionItem[] = contacts.map((c) => ({
    kind: "contact",
    id: c.id,
    createdAt: c.createdAt,
    label: inquiryLabel(c),
  }));

  // One item per conversation, id'd on its newest reply so each new text
  // looks "new" to the pollers and rings again.
  const smsItems: AttentionItem[] = listUnreadConversations().map((c) => ({
    kind: "sms",
    id: `sms:${c.lastId}`,
    createdAt: c.lastAt,
    label: `SMS · ${c.name}`,
    preview: c.lastPreview,
    count: c.unread,
    conversationKey: c.key,
  }));

  const items = [...orderItems, ...inquiryItems, ...contactItems, ...smsItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return {
    items,
    counts: {
      orders: orderItems.length,
      inquiries: inquiryItems.length,
      contacts: contactItems.length,
      sms: smsItems.length,
      total: items.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
