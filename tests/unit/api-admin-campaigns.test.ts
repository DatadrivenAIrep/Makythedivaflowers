import { describe, it, expect, beforeEach, vi } from "vitest";

const createDraftMock = vi.fn();
const listCampaignsMock = vi.fn();
const getCampaignMock = vi.fn();
const updateDraftMock = vi.fn();
vi.mock("@/lib/campaign-storage", () => ({
  createDraft: (...a: unknown[]) => createDraftMock(...a),
  listCampaigns: (...a: unknown[]) => listCampaignsMock(...a),
  getCampaign: (...a: unknown[]) => getCampaignMock(...a),
  updateDraft: (...a: unknown[]) => updateDraftMock(...a),
}));

const sendCampaignMock = vi.fn();
vi.mock("@/lib/campaign-sender", () => ({
  sendCampaign: (...a: unknown[]) => sendCampaignMock(...a),
  renderCampaignBody: () => "¡Hola Ana! Promo Responde STOP para cancelar.",
  smsSegments: () => 1,
}));

const listMarketingRecipientsMock = vi.fn();
vi.mock("@/lib/customer-storage", () => ({
  listMarketingRecipients: (...a: unknown[]) => listMarketingRecipientsMock(...a),
}));

import { POST as createPost, GET as listGet } from "@/app/api/admin/campaigns/route";
import { GET as detailGet, PATCH as detailPatch } from "@/app/api/admin/campaigns/[id]/route";
import { POST as sendPost } from "@/app/api/admin/campaigns/[id]/send/route";

function jsonReq(body: unknown) {
  return new Request("http://x/api/admin/campaigns", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  createDraftMock.mockReset().mockReturnValue({ id: "cmp_1", status: "draft" });
  listCampaignsMock.mockReset().mockReturnValue([{ id: "cmp_1" }]);
  getCampaignMock.mockReset().mockReturnValue({ id: "cmp_1", status: "draft" });
  updateDraftMock.mockReset().mockReturnValue({ id: "cmp_1", segment: "sms-marketing", status: "draft" });
  sendCampaignMock.mockReset().mockResolvedValue({ sent: 3, failed: 0, skipped: 1 });
  listMarketingRecipientsMock.mockReset().mockReturnValue([{ id: "c1" }, { id: "c2" }]);
});

function patchReq(body: unknown) {
  return new Request("http://x/api/admin/campaigns/cmp_1", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("POST /api/admin/campaigns", () => {
  it("creates a draft and returns the recipient count", async () => {
    const res = await createPost(jsonReq({ bodyEs: "Promo {nombre}", bodyEn: "" }));
    const data = await res.json();
    expect(createDraftMock).toHaveBeenCalledWith({ bodyEs: "Promo {nombre}", bodyEn: "" });
    expect(data.recipientCount).toBe(2);
  });

  it("rejects an empty ES body with 400", async () => {
    const res = await createPost(jsonReq({ bodyEs: "   " }));
    expect(res.status).toBe(400);
    expect(createDraftMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/campaigns", () => {
  it("lists campaigns", async () => {
    const res = await listGet();
    expect((await res.json()).campaigns).toHaveLength(1);
  });
});

describe("GET /api/admin/campaigns/[id]", () => {
  it("returns campaign detail with recipient count and bilingual previews", async () => {
    getCampaignMock.mockReturnValue({ id: "cmp_1", segment: "sms-marketing", status: "draft" });
    listMarketingRecipientsMock.mockReturnValue([{ id: "c1" }, { id: "c2" }, { id: "c3" }]);
    const res = await detailGet(new Request("http://x"), { params: Promise.resolve({ id: "cmp_1" }) });
    const data = await res.json();
    expect(data).toEqual({
      campaign: { id: "cmp_1", segment: "sms-marketing", status: "draft" },
      recipientCount: 3,
      previewEs: "¡Hola Ana! Promo Responde STOP para cancelar.",
      previewEn: "¡Hola Ana! Promo Responde STOP para cancelar.",
      segmentsEs: 1,
      segmentsEn: 1,
    });
  });

  it("404s when the campaign is missing", async () => {
    getCampaignMock.mockReturnValue(null);
    const res = await detailGet(new Request("http://x"), { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });
});

describe("PATCH /api/admin/campaigns/[id]", () => {
  it("updates a draft in place and returns refreshed detail", async () => {
    const res = await detailPatch(patchReq({ bodyEs: "nuevo", bodyEn: "" }), {
      params: Promise.resolve({ id: "cmp_1" }),
    });
    const data = await res.json();
    expect(updateDraftMock).toHaveBeenCalledWith("cmp_1", { bodyEs: "nuevo", bodyEn: "" });
    expect(data.recipientCount).toBe(2);
    expect(data.previewEs).toContain("Ana");
  });

  it("rejects an empty ES body with 400 without touching storage", async () => {
    const res = await detailPatch(patchReq({ bodyEs: "   " }), {
      params: Promise.resolve({ id: "cmp_1" }),
    });
    expect(res.status).toBe(400);
    expect(updateDraftMock).not.toHaveBeenCalled();
  });

  it("409s when the campaign is not a draft (updateDraft returns null)", async () => {
    updateDraftMock.mockReturnValue(null);
    const res = await detailPatch(patchReq({ bodyEs: "x" }), {
      params: Promise.resolve({ id: "cmp_1" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/admin/campaigns/[id]/send", () => {
  it("returns tallies from sendCampaign", async () => {
    const res = await sendPost(new Request("http://x", { method: "POST" }), {
      params: Promise.resolve({ id: "cmp_1" }),
    });
    expect(await res.json()).toEqual({ ok: true, sent: 3, failed: 0, skipped: 1 });
  });

  it("404s when the campaign is missing", async () => {
    getCampaignMock.mockReturnValue(null);
    const res = await sendPost(new Request("http://x", { method: "POST" }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(res.status).toBe(404);
    expect(sendCampaignMock).not.toHaveBeenCalled();
  });
});
