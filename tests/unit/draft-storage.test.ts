import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { saveDraft, listDrafts, getDraft, deleteDraft } from "@/lib/draft-storage";
import type { DraftPayload } from "@/types/draft";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const payload: DraftPayload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "pickup",
    recipient: { name: "Ana", phone: "5165550100" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 2 }],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

function input(id: string, label: string, when: string) {
  return { id, label, payload, itemCount: 2, totalCents: 10000, takenBy: "maky", createdAt: when, updatedAt: when };
}

describe("draft-storage", () => {
  it("saves and reads back a draft with its payload", () => {
    saveDraft(input("dr_1", "Ana", "2026-07-31T10:00:00Z"));
    const got = getDraft("dr_1");
    expect(got?.label).toBe("Ana");
    expect(got?.payload).toEqual(payload);
    expect(got?.itemCount).toBe(2);
  });

  it("returns null for an unknown id", () => {
    expect(getDraft("nope")).toBeNull();
  });

  it("upserts by id (same id updates, does not duplicate) and preserves created_at", () => {
    saveDraft(input("dr_1", "Ana", "2026-07-31T10:00:00Z"));
    const updated = saveDraft({
      ...input("dr_1", "Ana (edit)", "2026-07-31T11:00:00Z"),
      createdAt: "2026-07-31T11:00:00Z", // deliberately different; must be ignored on conflict
    });
    expect(updated.label).toBe("Ana (edit)");
    expect(updated.createdAt).toBe("2026-07-31T10:00:00Z"); // preserved
    expect(updated.updatedAt).toBe("2026-07-31T11:00:00Z");
    expect(listDrafts()).toHaveLength(1);
  });

  it("lists drafts newest-updated first", () => {
    saveDraft(input("dr_1", "First", "2026-07-31T10:00:00Z"));
    saveDraft(input("dr_2", "Second", "2026-07-31T12:00:00Z"));
    const list = listDrafts();
    expect(list.map((d) => d.id)).toEqual(["dr_2", "dr_1"]);
    expect(list[0]).not.toHaveProperty("payload");
  });

  it("deletes a draft", () => {
    saveDraft(input("dr_1", "Ana", "2026-07-31T10:00:00Z"));
    deleteDraft("dr_1");
    expect(getDraft("dr_1")).toBeNull();
    expect(listDrafts()).toHaveLength(0);
  });
});
