import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  groupConversations,
  listConversations,
  conversationThread,
  type RawEvent,
} from "@/lib/conversation-storage";

function ev(p: Partial<RawEvent>): RawEvent {
  return {
    id: "x",
    key: "k",
    phone: "5168512815",
    direction: "out",
    kind: "transactional",
    text: "t",
    at: "2026-08-01T00:00:00Z",
    ...p,
  };
}

describe("groupConversations (pure)", () => {
  it("groups by key, newest first, with the latest preview + direction", () => {
    const out = groupConversations([
      ev({ key: "cus_1", name: "Ana", at: "2026-08-01T00:00:00Z", text: "order received", direction: "out" }),
      ev({ key: "cus_1", name: "Ana", at: "2026-08-03T00:00:00Z", text: "gracias!", direction: "in" }),
      ev({ key: "cus_2", name: "Bob", at: "2026-08-02T00:00:00Z", text: "on the way", direction: "out" }),
    ]);
    expect(out.map((c) => c.key)).toEqual(["cus_1", "cus_2"]); // cus_1 latest is Aug 3
    expect(out[0]).toMatchObject({ name: "Ana", lastPreview: "gracias!", lastDirection: "in", count: 2 });
    expect(out[1]).toMatchObject({ name: "Bob", count: 1 });
  });

  it("fills in a name from a later event when the first event lacks one", () => {
    const out = groupConversations([
      ev({ key: "cus_1", phone: "5168512815", at: "2026-08-01T00:00:00Z" }),
      ev({ key: "cus_1", phone: "5168512815", name: "Ana", at: "2026-08-02T00:00:00Z" }),
    ]);
    expect(out[0].name).toBe("Ana");
  });
});

const DAY = 86_400_000;

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function seed() {
  const seen = new Date(Date.now() - 10 * DAY).toISOString();
  getDb()
    .prepare(
      `INSERT INTO customers (id, name, phone, email, order_count, first_seen_at, last_seen_at)
       VALUES ('c1', 'Ana', '5168512815', 'ana@x.com', 1, ?, ?)`,
    )
    .run(seen, seen);

  const t1 = new Date(Date.now() - 3 * DAY).toISOString();
  getDb()
    .prepare(
      `INSERT INTO messages (id, order_id, customer_id, channel, template, locale, to_phone,
         to_email, provider_sid, status, error, body, created_at, updated_at)
       VALUES ('m1', 'o1', 'c1', 'sms', 'order_confirmed', 'es', '5168512815', NULL, NULL,
         'sent', NULL, 'Tu pedido fue confirmado', ?, ?)`,
    )
    .run(t1, t1);

  const t2 = new Date(Date.now() - 2 * DAY).toISOString();
  getDb()
    .prepare(
      `INSERT INTO campaigns (id, body_es, body_en, segment, status, recipient_count,
         sent_count, failed_count, created_at, sent_at)
       VALUES ('camp1', 'Oferta especial hoy!', 'Special offer today!', 'sms-marketing',
         'sent', 1, 1, 0, ?, ?)`,
    )
    .run(t2, t2);
  getDb()
    .prepare(
      `INSERT INTO campaign_sends (id, campaign_id, customer_id, phone, status, provider_sid, error, created_at)
       VALUES ('cs1', 'camp1', 'c1', '5168512815', 'sent', NULL, NULL, ?)`,
    )
    .run(t2);

  const t3 = new Date(Date.now() - 1 * DAY).toISOString();
  getDb()
    .prepare(
      `INSERT INTO inbound_messages (id, from_phone, customer_id, body, provider_sid, created_at)
       VALUES ('in1', '5168512815', 'c1', 'gracias!', NULL, ?)`,
    )
    .run(t3);
}

describe("listConversations / conversationThread (DB-backed)", () => {
  it("groups transactional + campaign + inbound rows for the same customer into one conversation", () => {
    seed();
    const list = listConversations();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: "c1", name: "Ana", count: 3, lastDirection: "in", lastPreview: "gracias!" });

    const { conversation, thread } = conversationThread("c1");
    expect(conversation).toMatchObject({ key: "c1", count: 3 });
    expect(thread).toHaveLength(3);
    expect(thread.map((t) => t.kind)).toEqual(["transactional", "campaign", "inbound"]);
    expect(thread.map((t) => t.direction)).toEqual(["out", "out", "in"]);
    expect(thread[0]).toMatchObject({ text: "Tu pedido fue confirmado", template: "order_confirmed" });
    expect(thread[1]).toMatchObject({ text: "Oferta especial hoy!" });
    expect(thread[2]).toMatchObject({ text: "gracias!" });
    // chronological (oldest first)
    for (let i = 1; i < thread.length; i++) {
      expect(thread[i - 1].at <= thread[i].at).toBe(true);
    }
  });

  it("returns an empty thread and null conversation for an unknown key", () => {
    seed();
    const { conversation, thread } = conversationThread("nope");
    expect(conversation).toBeNull();
    expect(thread).toEqual([]);
  });

  it("folds a null-customer_id outbound row into the matching customer's thread by last-10 phone", () => {
    // Regression for the SMS inbox fragmentation bug: an outbound transactional
    // message can land with customer_id = NULL (e.g. an exact-digit lookup missed
    // because the order's phone was stored in an 11-digit form), while an inbound
    // reply from the same person resolves customer_id via fuzzy last-10 matching.
    // Without folding, that produces two threads for one person: one keyed by
    // customer id (named), one keyed by bare phone (unnamed).
    const seen = new Date(Date.now() - 10 * DAY).toISOString();
    getDb()
      .prepare(
        `INSERT INTO customers (id, name, phone, email, order_count, first_seen_at, last_seen_at)
         VALUES ('c1', 'Ana', '5168512815', 'ana@x.com', 1, ?, ?)`,
      )
      .run(seen, seen);

    const t1 = new Date(Date.now() - 2 * DAY).toISOString();
    getDb()
      .prepare(
        `INSERT INTO messages (id, order_id, customer_id, channel, template, locale, to_phone,
           to_email, provider_sid, status, error, body, created_at, updated_at)
         VALUES ('m1', 'o1', NULL, 'sms', 'order_confirmed', 'es', '15168512815', NULL, NULL,
           'sent', NULL, 'Tu pedido fue confirmado', ?, ?)`,
      )
      .run(t1, t1);

    const t2 = new Date(Date.now() - 1 * DAY).toISOString();
    getDb()
      .prepare(
        `INSERT INTO inbound_messages (id, from_phone, customer_id, body, provider_sid, created_at)
         VALUES ('in1', '5168512815', 'c1', 'gracias!', NULL, ?)`,
      )
      .run(t2);

    const list = listConversations();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: "c1", name: "Ana", count: 2 });
  });
});
