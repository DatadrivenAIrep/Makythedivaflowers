import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { GET as listGET, POST } from "@/app/api/admin/orders/drafts/route";
import { GET as detailGET, PUT, DELETE } from "@/app/api/admin/orders/drafts/[id]/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  runMigrations();
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

const payload = {
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

function post(body: unknown): Request {
  return new Request("http://localhost/api/admin/orders/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("drafts API", () => {
  it("creates, lists, reads, updates, and deletes a draft", async () => {
    // create
    const createRes = await POST(post({ payload, label: "Ana", itemCount: 2, totalCents: 10000 }));
    expect(createRes.status).toBe(201);
    const { id } = await createRes.json();
    expect(id).toMatch(/^dr_/);

    // list
    const listRes = await listGET();
    const { drafts } = await listRes.json();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].label).toBe("Ana");
    expect(drafts[0].payload).toBeUndefined();

    // read detail
    const getRes = await detailGET(new Request("http://localhost"), ctx(id));
    expect(getRes.status).toBe(200);
    const detail = await getRes.json();
    expect(detail.draft.payload.customer.name).toBe("Ana");

    // update (PUT) — same id, no duplicate
    const putReq = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, label: "Ana (edit)", itemCount: 2, totalCents: 12000 }),
    });
    const putRes = await PUT(putReq, ctx(id));
    expect(putRes.status).toBe(200);
    expect((await listGET().then((r) => r.json())).drafts).toHaveLength(1);

    // delete
    const delRes = await DELETE(new Request("http://localhost"), ctx(id));
    expect(delRes.status).toBe(200);
    expect((await listGET().then((r) => r.json())).drafts).toHaveLength(0);
  });

  it("returns 400 for an invalid create body", async () => {
    const res = await POST(post({ label: "no payload" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 reading a missing draft", async () => {
    const res = await detailGET(new Request("http://localhost"), ctx("dr_missing"));
    expect(res.status).toBe(404);
  });

  it("returns 404 updating a missing draft (PUT)", async () => {
    const putReq = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, label: "x", itemCount: 0, totalCents: 0 }),
    });
    const res = await PUT(putReq, ctx("dr_missing"));
    expect(res.status).toBe(404);
  });

  it("DELETE of a nonexistent draft is idempotent (200 ok)", async () => {
    const res = await DELETE(new Request("http://localhost"), ctx("dr_never"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 400 for unparseable JSON on create", async () => {
    const req = new Request("http://localhost/api/admin/orders/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json!!!",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
