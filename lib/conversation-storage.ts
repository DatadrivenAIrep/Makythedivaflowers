import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { normalizePhone, getCustomerById } from "@/lib/customer-storage";

export type ThreadMessage = {
  id: string;
  direction: "in" | "out";
  kind: "transactional" | "campaign" | "inbound";
  text: string;
  template?: string;
  status?: string;
  at: string;
};
export type RawEvent = ThreadMessage & { key: string; customerId?: string; phone: string; name?: string };
export type Conversation = {
  key: string;
  name: string;
  phone: string;
  customerId?: string;
  lastAt: string;
  lastPreview: string;
  lastDirection: "in" | "out";
  count: number;
};

function last10(p: string): string {
  return normalizePhone(p).slice(-10);
}

export function groupConversations(events: RawEvent[]): Conversation[] {
  const map = new Map<string, Conversation & { _latest: string }>();
  for (const e of events) {
    const cur = map.get(e.key);
    if (!cur) {
      map.set(e.key, {
        key: e.key,
        name: e.name || e.phone,
        phone: e.phone,
        customerId: e.customerId,
        lastAt: e.at,
        lastPreview: e.text,
        lastDirection: e.direction,
        count: 1,
        _latest: e.at,
      });
    } else {
      cur.count++;
      if (e.name && cur.name === cur.phone) cur.name = e.name; // fill a name if a later event has one
      if (e.at >= cur._latest) {
        cur._latest = e.at;
        cur.lastAt = e.at;
        cur.lastPreview = e.text;
        cur.lastDirection = e.direction;
      }
    }
  }
  return [...map.values()]
    .map(({ _latest, ...c }) => c)
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
}

type MsgRow = {
  id: string;
  customer_id: string | null;
  to_phone: string | null;
  template: string;
  body: string | null;
  status: string;
  created_at: string;
};
type CampRow = { id: string; customer_id: string; phone: string; status: string; created_at: string; body_es: string };
type InRow = { id: string; customer_id: string | null; from_phone: string; body: string; created_at: string };

function nameFor(
  customerId: string | null | undefined,
  phone: string,
): { key: string; name?: string; phone: string; customerId?: string } {
  if (customerId) {
    const c = getCustomerById(customerId);
    return { key: customerId, name: c?.name, phone: c?.phone ?? phone, customerId };
  }
  return { key: last10(phone), phone };
}

function fetchEvents(limit: number): RawEvent[] {
  const db = getDb();
  const events: RawEvent[] = [];
  const msgs = db
    .prepare(
      `SELECT id, customer_id, to_phone, template, body, status, created_at
       FROM messages ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as MsgRow[];
  for (const m of msgs) {
    const who = nameFor(m.customer_id, m.to_phone ?? "");
    events.push({
      ...who,
      id: m.id,
      direction: "out",
      kind: "transactional",
      text: m.body ?? "",
      template: m.template,
      status: m.status,
      at: m.created_at,
    });
  }
  const camps = db
    .prepare(
      `SELECT cs.id, cs.customer_id, cs.phone, cs.status, cs.created_at, c.body_es
       FROM campaign_sends cs JOIN campaigns c ON c.id = cs.campaign_id
       ORDER BY cs.created_at DESC LIMIT ?`,
    )
    .all(limit) as CampRow[];
  for (const cs of camps) {
    const who = nameFor(cs.customer_id, cs.phone);
    events.push({ ...who, id: cs.id, direction: "out", kind: "campaign", text: cs.body_es, status: cs.status, at: cs.created_at });
  }
  const ins = db
    .prepare(
      `SELECT id, customer_id, from_phone, body, created_at
       FROM inbound_messages ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as InRow[];
  for (const i of ins) {
    const who = nameFor(i.customer_id, i.from_phone);
    events.push({ ...who, id: i.id, direction: "in", kind: "inbound", text: i.body, at: i.created_at });
  }
  return events;
}

export function listConversations(limit = 500): Conversation[] {
  runMigrations();
  return groupConversations(fetchEvents(limit));
}

export function conversationThread(key: string): { conversation: Conversation | null; thread: ThreadMessage[] } {
  runMigrations();
  const events = fetchEvents(2000).filter((e) => e.key === key);
  const conversation = groupConversations(events)[0] ?? null;
  const thread = events
    .map(({ key: _k, customerId: _c, phone: _p, name: _n, ...t }) => t)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)); // chronological
  return { conversation, thread };
}
