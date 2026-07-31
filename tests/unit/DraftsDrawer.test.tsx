import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, vars?: Record<string, unknown>) => (vars ? `${k}:${JSON.stringify(vars)}` : k),
}));

import DraftsDrawer from "@/components/admin/intake/DraftsDrawer";
import type { OrderDraft, DraftPayload } from "@/types/draft";

const draft: OrderDraft = {
  id: "dr_1",
  label: "Ana",
  itemCount: 2,
  totalCents: 10000,
  takenBy: "maky",
  createdAt: "2026-07-31T10:00:00Z",
  updatedAt: "2026-07-31T10:00:00Z",
};

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
  lines: [],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

function mockFetchSequence() {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/api/admin/orders/drafts")) {
      return new Response(JSON.stringify({ drafts: [draft] }), { status: 200 });
    }
    if (url.includes("/api/admin/orders/drafts/dr_1") && init?.method === "DELETE") {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes("/api/admin/orders/drafts/dr_1")) {
      return new Response(JSON.stringify({ draft: { ...draft, payload } }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DraftsDrawer", () => {
  it("lists drafts and resumes one with its payload", async () => {
    mockFetchSequence();
    const onResume = vi.fn();
    render(<DraftsDrawer locale="es" onResume={onResume} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "draft_resume" }));
    await waitFor(() => expect(onResume).toHaveBeenCalled());
    const [passedPayload, passedId] = onResume.mock.calls[0];
    expect(passedId).toBe("dr_1");
    expect(passedPayload.customer.name).toBe("Ana");
  });

  it("deletes a draft and removes its row", async () => {
    mockFetchSequence();
    render(<DraftsDrawer locale="es" onResume={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "draft_delete" }));
    await waitFor(() => expect(screen.queryByText("Ana")).toBeNull());
  });

  it("notifies the parent when a draft is deleted", async () => {
    mockFetchSequence();
    const onDeleted = vi.fn();
    render(<DraftsDrawer locale="es" onResume={() => {}} onClose={() => {}} onDeleted={onDeleted} />);
    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "draft_delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("dr_1"));
  });

  it("shows an empty state when there are no drafts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ drafts: [] }), { status: 200 }),
    );
    render(<DraftsDrawer locale="es" onResume={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("drafts_empty")).toBeDefined());
  });

  it("keeps the row when DELETE fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/admin/orders/drafts")) {
        return new Response(JSON.stringify({ drafts: [draft] }), { status: 200 });
      }
      if (url.includes("/api/admin/orders/drafts/dr_1") && init?.method === "DELETE") {
        return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
      }
      return new Response("{}", { status: 200 });
    });
    render(<DraftsDrawer locale="es" onResume={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: "draft_delete" }));
    // wait until the (failed) request settles and the button re-enables
    await waitFor(() => expect(screen.getByRole("button", { name: "draft_delete" })).not.toBeDisabled());
    // row must still be present because the DELETE failed
    expect(screen.getByText("Ana")).toBeDefined();
  });
});
