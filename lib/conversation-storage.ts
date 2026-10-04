import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { normalizePhone, getCustomerById, getByPhoneUS } from "@/lib/customer-storage";
import { formatPhoneUS } from "@/lib/format";

export type ThreadMessage = {
  id: string;
  direction: "in" | "out";
  kind: "transactional" | "campaign" | "inbound";
  text: string;
  template?: string;
  status?: string;
  at: string;
};
export type RawEvent = ThreadMessage & {
  key: string; customerId?: string; phone: string; name?: string;
  unread?: boolean; // inbound only: the shop hasn't opened this reply yet
};
export type Conversation = {
  key: string;
  name: string;
  phone: string;
  customerId?: string;
  lastAt: string;
  lastPreview: string;
  lastDirection: "in" | "out";
  count: number;
  unread: number;
};

/** A conversation with customer replies nobody has opened yet. */
export type UnreadConversation = {
  key: string;
  name: string;
  phone: string;
  unread: number;
  lastAt: string;
  lastPreview: string;
  lastId: string; // newest unread message — changes on every new reply
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
        unread: e.unread ? 1 : 0,
        _latest: e.at,
      });
    } else {
      cur.count++;
      if (e.unread) cur.unread++;
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
type InRow = {
  id: string; customer_id: string | null; from_phone: string; body: string;
  created_at: string; read_at: string | null;
};
type HasRow = { id: string; body: string | null; sent_at: string | null; created_at: string; billing_phone: string };

type NameForResult = { key: string; name?: string; phone: string; customerId?: string };

/**
 * Resolve an event's grouping key. When it already carries a `customerId`
 * (set at dispatch/webhook time from an exact or fuzzy phone match), key on
 * that customer directly. Otherwise — most often an outbound row whose
 * `customer_id` came back NULL from an exact-match lookup — try the same
 * fuzzy last-10-digit resolution the inbound webhook uses (`getByPhoneUS`)
 * before falling back to a bare phone key. This folds a phone-keyed event
 * into the matching customer's thread instead of fragmenting it into a
 * second, unnamed conversation.
 *
 * `phoneCache` memoizes the no-customerId branch per `fetchEvents` call so
 * repeated events from the same unlinked phone number only hit the DB once.
 */
function nameFor(
  customerId: string | null | undefined,
  phone: string,
  phoneCache: Map<string, NameForResult>,
): NameForResult {
  if (customerId) {
    const c = getCustomerById(customerId);
    return { key: customerId, name: c?.name, phone: c?.phone ?? phone, customerId };
  }
  const cacheKey = last10(phone);
  const cached = phoneCache.get(cacheKey);
  if (cached) return cached;
  const byPhone = getByPhoneUS(phone);
  const resolved: NameForResult = byPhone
    ? { key: byPhone.id, name: byPhone.name, phone: byPhone.phone, customerId: byPhone.id }
    : { key: cacheKey, phone };
  phoneCache.set(cacheKey, resolved);
  return resolved;
}

function fetchEvents(limit: number): RawEvent[] {
  const db = getDb();
  const events: RawEvent[] = [];
  const phoneCache = new Map<string, NameForResult>();
  const msgs = db
    .prepare(
      `SELECT id, customer_id, to_phone, template, body, status, created_at
       FROM messages ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as MsgRow[];
  for (const m of msgs) {
    const who = nameFor(m.customer_id, m.to_phone ?? "", phoneCache);
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
    const who = nameFor(cs.customer_id, cs.phone, phoneCache);
    events.push({ ...who, id: cs.id, direction: "out", kind: "campaign", text: cs.body_es, status: cs.status, at: cs.created_at });
  }
  const ins = db
    .prepare(
      `SELECT id, customer_id, from_phone, body, created_at, read_at
       FROM inbound_messages ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as InRow[];
  for (const i of ins) {
    const who = nameFor(i.customer_id, i.from_phone, phoneCache);
    events.push({
      ...who, id: i.id, direction: "in", kind: "inbound", text: i.body, at: i.created_at, unread: !i.read_at,
    });
  }
  // House-account statement / reminder texts. They are logged in their own
  // queue table (not `messages`, whose order_id is NOT NULL), so the inbox
  // reads them from there, attributed by the account's billing phone.
  const hs = db
    .prepare(
      `SELECT s.id, s.body, s.sent_at, s.created_at, a.billing_phone
         FROM house_account_sends s JOIN house_accounts a ON a.id = s.account_id
        WHERE s.status = 'sent' AND s.sms_sid IS NOT NULL AND a.billing_phone IS NOT NULL
        ORDER BY s.sent_at DESC LIMIT ?`,
    )
    .all(limit) as HasRow[];
  for (const h of hs) {
    const who = nameFor(null, h.billing_phone, phoneCache);
    events.push({
      ...who, id: h.id, direction: "out", kind: "transactional", text: h.body ?? "",
      template: "house_statement", status: "sent", at: h.sent_at ?? h.created_at,
    });
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
    .map(({ key: _k, customerId: _c, phone: _p, name: _n, unread: _u, ...t }) => t)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)); // chronological
  return { conversation, thread };
}

/**
 * Unread customer replies, grouped into conversations with the same key
 * resolution as the inbox (customer id, else last-10 phone), newest first.
 */
export function listUnreadConversations(): UnreadConversation[] {
  runMigrations();
  const rows = getDb()
    .prepare(
      `SELECT id, customer_id, from_phone, body, created_at, read_at
         FROM inbound_messages WHERE read_at IS NULL
        ORDER BY created_at ASC, rowid ASC`,
    )
    .all() as InRow[];
  const phoneCache = new Map<string, NameForResult>();
  const map = new Map<string, UnreadConversation>();
  for (const r of rows) {
    const who = nameFor(r.customer_id, r.from_phone, phoneCache);
    const cur = map.get(who.key);
    if (cur) {
      cur.unread++;
      cur.lastAt = r.created_at;
      cur.lastPreview = r.body;
      cur.lastId = r.id;
    } else {
      map.set(who.key, {
        key: who.key, name: who.name || formatPhoneUS(who.phone), phone: who.phone, unread: 1,
        lastAt: r.created_at, lastPreview: r.body, lastId: r.id,
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : 0));
}

/** Mark every unread reply in one conversation as read. Returns how many changed. */
export function markConversationRead(key: string, now: Date = new Date()): number {
  runMigrations();
  const db = getDb();
  const rows = db
    .prepare("SELECT id, customer_id, from_phone FROM inbound_messages WHERE read_at IS NULL")
    .all() as Pick<InRow, "id" | "customer_id" | "from_phone">[];
  const phoneCache = new Map<string, NameForResult>();
  const ids = rows.filter((r) => nameFor(r.customer_id, r.from_phone, phoneCache).key === key).map((r) => r.id);
  const update = db.prepare("UPDATE inbound_messages SET read_at = ? WHERE id = ? AND read_at IS NULL");
  const stamp = now.toISOString();
  let changed = 0;
  for (const id of ids) changed += Number(update.run(stamp, id).changes);
  return changed;
}
