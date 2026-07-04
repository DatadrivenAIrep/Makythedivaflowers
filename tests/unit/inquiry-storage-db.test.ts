import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import {
  createInquiry, listInquiries, getInquiry, changeStage,
  updateNotes, setFollowUp, markLost, acknowledge,
} from "@/lib/inquiry-storage-db";

const NOW = new Date("2026-07-04T12:00:00Z");

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

function base(id: string, over: Record<string, unknown> = {}) {
  return {
    id, type: "wedding" as const, contactName: "Ana", contactEmail: "ana@x.com",
    contactPhone: "5551", budgetBand: "10-25k" as const, sourceChannel: "web" as const,
    ...over,
  };
}

describe("createInquiry + listInquiries + getInquiry", () => {
  it("creates web + manual inquiries at stage nuevo with a created history row", () => {
    createInquiry(base("iq1", { eventDate: "2027-06-01", venue: "Glen Cove", guests: 120, vibe: "garden" }), NOW);
    createInquiry({ id: "iq2", type: "event", contactName: "Bob", contactEmail: "b@x.com",
      contactPhone: "5552", company: "Acme", frequency: "monthly", sourceChannel: "manual" }, NOW);

    const all = listInquiries();
    expect(all.map((i) => i.id).sort()).toEqual(["iq1", "iq2"]);
    const iq1 = all.find((i) => i.id === "iq1")!;
    expect(iq1.stage).toBe("nuevo");
    expect(iq1.guests).toBe(120);
    expect(iq1.sourceChannel).toBe("web");

    const detail = getInquiry("iq2");
    expect(detail?.inquiry.company).toBe("Acme");
    expect(detail?.changes.map((c) => c.kind)).toEqual(["created"]);
  });

  it("generates an id when none is given (manual add)", () => {
    const created = createInquiry({ type: "wedding", contactName: "C", contactEmail: "c@x.com",
      contactPhone: "5553", sourceChannel: "manual" }, NOW);
    expect(created.id).toMatch(/^iq_/);
    expect(listInquiries()).toHaveLength(1);
  });
});

describe("mutations write history", () => {
  it("changeStage updates stage and logs a stage change", () => {
    createInquiry(base("iq1"), NOW);
    const updated = changeStage("iq1", "propuesta", "maky", NOW);
    expect(updated?.inquiry.stage).toBe("propuesta");
    const kinds = updated!.changes.map((c) => c.kind);
    expect(kinds).toContain("stage");
  });

  it("changeStage rejects an invalid target stage (returns null, no write)", () => {
    createInquiry(base("iq1"), NOW);
    expect(changeStage("iq1", "bogus", "maky", NOW)).toBeNull();
    expect(getInquiry("iq1")?.inquiry.stage).toBe("nuevo");
  });

  it("updateNotes and setFollowUp persist and log", () => {
    createInquiry(base("iq1"), NOW);
    expect(updateNotes("iq1", "llamar el viernes", "maky", NOW)?.inquiry.notes).toBe("llamar el viernes");
    expect(setFollowUp("iq1", "2026-08-01", "maky", NOW)?.inquiry.followUpDate).toBe("2026-08-01");
    const kinds = getInquiry("iq1")!.changes.map((c) => c.kind);
    expect(kinds).toEqual(["created", "note", "followup"]);
  });

  it("markLost sets stage=perdido + reason and logs", () => {
    createInquiry(base("iq1"), NOW);
    const lost = markLost("iq1", "presupuesto", "maky", NOW);
    expect(lost?.inquiry.stage).toBe("perdido");
    expect(lost?.inquiry.lostReason).toBe("presupuesto");
    expect(lost?.changes.some((c) => c.kind === "lost")).toBe(true);
  });

  it("acknowledge sets acknowledged_at once (idempotent, no duplicate)", () => {
    createInquiry(base("iq1"), NOW);
    const first = acknowledge("iq1", NOW)?.inquiry.acknowledgedAt;
    expect(first).toBe(NOW.toISOString());
    const later = new Date("2026-07-05T00:00:00Z");
    expect(acknowledge("iq1", later)?.inquiry.acknowledgedAt).toBe(first); // unchanged
  });

  it("mutations on an unknown id return null", () => {
    expect(changeStage("nope", "contactado", "maky", NOW)).toBeNull();
    expect(getInquiry("nope")).toBeNull();
  });

  it("no-op notes/follow-up saves don't add history rows", () => {
    createInquiry(base("iq1"), NOW);
    updateNotes("iq1", "call friday", "maky", NOW);
    setFollowUp("iq1", "2026-08-01", "maky", NOW);
    const before = getInquiry("iq1")!.changes.length; // created + note + followup = 3
    // Save again with identical values → no new history
    updateNotes("iq1", "call friday", "maky", NOW);
    setFollowUp("iq1", "2026-08-01", "maky", NOW);
    expect(getInquiry("iq1")!.changes.length).toBe(before);
  });
});
