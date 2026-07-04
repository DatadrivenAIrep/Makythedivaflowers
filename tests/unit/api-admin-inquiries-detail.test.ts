import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { createInquiry } from "@/lib/inquiry-storage-db";
import { GET, PATCH } from "@/app/api/admin/inquiries/[id]/route";
import { POST as ACK } from "@/app/api/admin/inquiries/[id]/ack/route";

beforeEach(() => { vi.stubEnv("SQLITE_FILE", ":memory:"); runMigrations(); });
afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function seed() {
  createInquiry({ id: "iq1", type: "wedding", contactName: "Ana", contactEmail: "a@x.com",
    contactPhone: "5551", budgetBand: "10-25k", sourceChannel: "web" });
}
const patch = (b: unknown) => new Request("http://x", { method: "PATCH", body: JSON.stringify(b) });

describe("GET /[id]", () => {
  it("returns inquiry + changes; 404 unknown", async () => {
    seed();
    const res = await GET(new Request("http://x"), ctx("iq1"));
    expect(res.status).toBe(200);
    expect((await res.json()).inquiry.contactName).toBe("Ana");
    expect((await GET(new Request("http://x"), ctx("nope"))).status).toBe(404);
  });
});

describe("PATCH /[id]", () => {
  it("changes stage", async () => {
    seed();
    const res = await PATCH(patch({ stage: "contactado" }), ctx("iq1"));
    expect(res.status).toBe(200);
    expect((await res.json()).inquiry.stage).toBe("contactado");
  });
  it("updates notes and follow-up", async () => {
    seed();
    expect((await (await PATCH(patch({ notes: "x" }), ctx("iq1"))).json()).inquiry.notes).toBe("x");
    expect((await (await PATCH(patch({ followUpDate: "2026-08-01" }), ctx("iq1"))).json()).inquiry.followUpDate).toBe("2026-08-01");
  });
  it("marks lost with a reason", async () => {
    seed();
    const res = await PATCH(patch({ lost: { reason: "presupuesto" } }), ctx("iq1"));
    const body = await res.json();
    expect(body.inquiry.stage).toBe("perdido");
    expect(body.inquiry.lostReason).toBe("presupuesto");
  });
  it("400 empty patch, 400 bad stage, 404 unknown", async () => {
    seed();
    expect((await PATCH(patch({}), ctx("iq1"))).status).toBe(400);
    expect((await PATCH(patch({ stage: "bogus" }), ctx("iq1"))).status).toBe(400);
    expect((await PATCH(patch({ stage: "contactado" }), ctx("nope"))).status).toBe(404);
  });
  it("400s when lost and stage are sent together (contradictory)", async () => {
    seed();
    const res = await PATCH(patch({ lost: { reason: "x" }, stage: "propuesta" }), ctx("iq1"));
    expect(res.status).toBe(400);
    // the inquiry is untouched — still nuevo, no lost reason
    const after = await (await GET(new Request("http://x"), ctx("iq1"))).json();
    expect(after.inquiry.stage).toBe("nuevo");
    expect(after.inquiry.lostReason).toBeUndefined();
  });
});

describe("POST /[id]/ack", () => {
  it("acknowledges (idempotent)", async () => {
    seed();
    const res = await ACK(new Request("http://x", { method: "POST" }), ctx("iq1"));
    expect(res.status).toBe(200);
    expect((await res.json()).inquiry.acknowledgedAt).toBeTruthy();
    expect((await ACK(new Request("http://x", { method: "POST" }), ctx("nope"))).status).toBe(404);
  });
});
