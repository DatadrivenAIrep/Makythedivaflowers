import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getByPhone, upsertOnOrder } from "@/lib/customer-storage";
import { closeDb } from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("customer-storage", () => {
  it("getByPhone returns null when no customer exists", () => {
    expect(getByPhone("5165550100")).toBeNull();
  });

  it("upsertOnOrder creates a customer and counts the order", () => {
    const c1 = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      email: "m@x.com",
      address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      orderAt: "2026-05-16T10:00:00Z",
    });
    expect(c1.orderCount).toBe(1);
    const c2 = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-16T11:00:00Z",
    });
    expect(c2.orderCount).toBe(2);
    expect(c2.id).toBe(c1.id);
  });

  it("getByPhone normalizes non-digit input", () => {
    upsertOnOrder({ name: "Maria", phone: "5165550100", orderAt: "2026-05-16T10:00:00Z" });
    const got = getByPhone("(516) 555-0100");
    expect(got?.name).toBe("Maria");
  });
});


describe("messaging preferences", () => {
  it("upsertOnOrder persists messagingChannel + locale", () => {
    const c = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T10:00:00Z",
      messagingChannel: "whatsapp",
      locale: "es",
    });
    expect(c.messagingChannel).toBe("whatsapp");
    expect(c.locale).toBe("es");
  });

  it("upsertOnOrder preserves existing preferences when omitted on update", () => {
    upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T10:00:00Z",
      messagingChannel: "whatsapp",
      locale: "es",
    });
    const c2 = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T11:00:00Z",
    });
    expect(c2.messagingChannel).toBe("whatsapp");
    expect(c2.locale).toBe("es");
  });

  it("upsertOnOrder overwrites preferences when explicitly provided", () => {
    upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T10:00:00Z",
      messagingChannel: "sms",
    });
    const c2 = upsertOnOrder({
      name: "Maria",
      phone: "5165550100",
      orderAt: "2026-05-17T11:00:00Z",
      messagingChannel: "whatsapp",
    });
    expect(c2.messagingChannel).toBe("whatsapp");
  });
});