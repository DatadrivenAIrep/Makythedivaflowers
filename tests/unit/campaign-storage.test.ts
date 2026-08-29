import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  createDraft, getCampaign, listCampaigns, markSending, recordSend, finalizeCampaign, updateDraft,
} from "@/lib/campaign-storage";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("campaign-storage", () => {
  it("creates a draft and reads it back", () => {
    const c = createDraft({ bodyEs: "Hola {nombre}", bodyEn: "Hi {nombre}" });
    expect(c.status).toBe("draft");
    expect(c.bodyEs).toBe("Hola {nombre}");
    expect(getCampaign(c.id)?.id).toBe(c.id);
  });

  it("defaults body_en to empty and segment to sms-marketing", () => {
    const c = createDraft({ bodyEs: "Promo" });
    expect(c.bodyEn).toBe("");
    expect(c.segment).toBe("sms-marketing");
  });

  it("markSending transitions draft->sending exactly once", () => {
    const c = createDraft({ bodyEs: "x" });
    expect(markSending(c.id)).toBe(true);
    expect(markSending(c.id)).toBe(false); // already sending
    expect(getCampaign(c.id)?.status).toBe("sending");
  });

  it("records sends and finalizes with counts", () => {
    const c = createDraft({ bodyEs: "x" });
    markSending(c.id);
    recordSend({ campaignId: c.id, customerId: "cus_1", phone: "5168512815", status: "sent", providerSid: "SM1" });
    recordSend({ campaignId: c.id, customerId: "cus_2", phone: "5168512816", status: "failed", error: "boom" });
    finalizeCampaign(c.id, { sent: 1, failed: 1 });
    const done = getCampaign(c.id);
    expect(done?.status).toBe("sent");
    expect(done?.sentCount).toBe(1);
    expect(done?.failedCount).toBe(1);
    expect(done?.sentAt).toBeTruthy();
  });

  it("updateDraft edits a draft's bodies in place and returns it", () => {
    const c = createDraft({ bodyEs: "old es", bodyEn: "" });
    const u = updateDraft(c.id, { bodyEs: "new es", bodyEn: "new en" });
    expect(u?.bodyEs).toBe("new es");
    expect(u?.bodyEn).toBe("new en");
    expect(getCampaign(c.id)?.bodyEs).toBe("new es"); // persisted, same row
  });

  it("updateDraft returns null once the campaign is no longer a draft (and leaves it unchanged)", () => {
    const c = createDraft({ bodyEs: "x" });
    markSending(c.id); // status now 'sending'
    expect(updateDraft(c.id, { bodyEs: "y" })).toBeNull();
    expect(getCampaign(c.id)?.bodyEs).toBe("x");
  });

  it("updateDraft returns null for a missing id", () => {
    expect(updateDraft("nope", { bodyEs: "y" })).toBeNull();
  });

  it("lists campaigns newest first", () => {
    const a = createDraft({ bodyEs: "a" });
    const b = createDraft({ bodyEs: "b" });
    const ids = listCampaigns().map((c) => c.id);
    expect(ids.slice(0, 2)).toEqual([b.id, a.id]);
  });
});
