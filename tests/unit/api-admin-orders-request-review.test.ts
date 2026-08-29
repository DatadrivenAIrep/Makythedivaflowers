import { describe, it, expect, beforeEach, vi } from "vitest";

const getOrderMock = vi.fn();
vi.mock("@/lib/order-storage", () => ({ getOrder: (...a: unknown[]) => getOrderMock(...a) }));
const dispatchReviewRequestMock = vi.fn();
vi.mock("@/lib/order-dispatch", () => ({
  dispatchReviewRequest: (...a: unknown[]) => dispatchReviewRequestMock(...a),
}));

import { POST } from "@/app/api/admin/orders/[id]/request-review/route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getOrderMock.mockReset().mockResolvedValue({ id: "do_1" });
  dispatchReviewRequestMock.mockReset().mockResolvedValue({ ok: true });
});

describe("POST /api/admin/orders/[id]/request-review", () => {
  it("dispatches the review request and returns its result", async () => {
    const res = await POST(new Request("http://x", { method: "POST" }), ctx("do_1"));
    expect(dispatchReviewRequestMock).toHaveBeenCalledWith({ id: "do_1" });
    expect(await res.json()).toEqual({ ok: true });
  });

  it("passes through a skip reason", async () => {
    dispatchReviewRequestMock.mockResolvedValue({ ok: false, reason: "no_review_url" });
    const res = await POST(new Request("http://x", { method: "POST" }), ctx("do_1"));
    expect(await res.json()).toEqual({ ok: false, reason: "no_review_url" });
  });

  it("404s when the order is missing without dispatching", async () => {
    getOrderMock.mockResolvedValue(null);
    const res = await POST(new Request("http://x", { method: "POST" }), ctx("nope"));
    expect(res.status).toBe(404);
    expect(dispatchReviewRequestMock).not.toHaveBeenCalled();
  });
});
