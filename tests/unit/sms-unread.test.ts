import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { insertInboundMessage, listInboundMessages } from "@/lib/inbound-storage";
import {
  listUnreadConversations,
  markConversationRead,
  listConversations,
} from "@/lib/conversation-storage";
import { upsertOnOrder } from "@/lib/customer-storage";
import { getAttention } from "@/lib/attention";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => { vi.useRealTimers(); closeDb(); vi.unstubAllEnvs(); });

describe("inbound read state", () => {
  it("a new inbound message is unread; read:true stores it already read", () => {
    insertInboundMessage({ fromPhone: "5165550001", body: "hola" });
    insertInboundMessage({ fromPhone: "5165550001", body: "STOP", read: true });
    const rows = listInboundMessages();
    expect(rows.find((r) => r.body === "hola")?.readAt).toBeUndefined();
    expect(rows.find((r) => r.body === "STOP")?.readAt).toBeTruthy();
  });
});

describe("listUnreadConversations", () => {
  it("groups unread inbound by conversation with count, latest preview and latest id", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-10-04T14:00:00Z"));
    insertInboundMessage({ fromPhone: "5165550001", body: "hola" });
    vi.setSystemTime(new Date("2026-10-04T14:05:00Z"));
    const latest = insertInboundMessage({ fromPhone: "5165550001", body: "¿tienen rosas?" });
    vi.setSystemTime(new Date("2026-10-04T14:01:00Z"));
    insertInboundMessage({ fromPhone: "5165550002", body: "gracias" });

    const out = listUnreadConversations();
    expect(out.map((c) => c.key)).toEqual(["5165550001", "5165550002"]); // newest first
    expect(out[0]).toMatchObject({
      unread: 2, lastPreview: "¿tienen rosas?", lastId: latest, phone: "5165550001",
      lastAt: "2026-10-04T14:05:00.000Z",
    });
    expect(out[1]).toMatchObject({ unread: 1, lastPreview: "gracias" });
  });

  it("resolves a known customer by phone and uses their name + id as the key", () => {
    const c = upsertOnOrder({ name: "Ana López", phone: "(516) 555-0001", orderAt: "2026-10-01T00:00:00Z" });
    insertInboundMessage({ fromPhone: "+15165550001", body: "hola" });
    const [conv] = listUnreadConversations();
    expect(conv).toMatchObject({ key: c.id, name: "Ana López", unread: 1 });
  });

  it("ignores messages already read", () => {
    insertInboundMessage({ fromPhone: "5165550001", body: "STOP", read: true });
    expect(listUnreadConversations()).toEqual([]);
  });
});

describe("markConversationRead", () => {
  it("marks only that conversation's unread messages and reports how many", () => {
    insertInboundMessage({ fromPhone: "5165550001", body: "a" });
    insertInboundMessage({ fromPhone: "5165550001", body: "b" });
    insertInboundMessage({ fromPhone: "5165550002", body: "c" });
    expect(markConversationRead("5165550001")).toBe(2);
    expect(listUnreadConversations().map((c) => c.key)).toEqual(["5165550002"]);
    expect(markConversationRead("5165550001")).toBe(0);
  });

  it("marks a customer-keyed conversation read", () => {
    const c = upsertOnOrder({ name: "Ana", phone: "5165550001", orderAt: "2026-10-01T00:00:00Z" });
    insertInboundMessage({ fromPhone: "+15165550001", body: "hola" });
    expect(markConversationRead(c.id)).toBe(1);
    expect(listUnreadConversations()).toEqual([]);
  });
});

describe("listConversations unread", () => {
  it("carries the unread count per conversation", () => {
    insertInboundMessage({ fromPhone: "5165550001", body: "a" });
    insertInboundMessage({ fromPhone: "5165550001", body: "b", read: true });
    const [conv] = listConversations();
    expect(conv.unread).toBe(1);
  });
});

describe("migration 032", () => {
  it("is applied and backfills pre-existing inbound rows as read", () => {
    const row = getDb()
      .prepare("SELECT name FROM schema_migrations WHERE name = '032_inbound_read.sql'")
      .get();
    expect(row).toBeTruthy();
    const sql = fs.readFileSync("db/migrations/032_inbound_read.sql", "utf8");
    expect(sql).toMatch(/UPDATE inbound_messages SET read_at = created_at WHERE read_at IS NULL/);
  });
});

describe("attention radar", () => {
  it("surfaces one sms item per unread conversation, keyed on its latest message", async () => {
    insertInboundMessage({ fromPhone: "5165550001", body: "hola" });
    const second = insertInboundMessage({ fromPhone: "5165550001", body: "¿abren hoy?" });
    const snap = await getAttention();
    expect(snap.counts.sms).toBe(1);
    expect(snap.counts.total).toBe(1);
    expect(snap.items[0]).toMatchObject({
      kind: "sms",
      id: `sms:${second}`,
      label: "SMS · (516) 555-0001",
      preview: "¿abren hoy?",
      count: 2,
      conversationKey: "5165550001",
    });
  });

  it("drops the item once the conversation is read", async () => {
    insertInboundMessage({ fromPhone: "5165550001", body: "hola" });
    markConversationRead("5165550001");
    expect((await getAttention()).counts.sms).toBe(0);
  });
});
