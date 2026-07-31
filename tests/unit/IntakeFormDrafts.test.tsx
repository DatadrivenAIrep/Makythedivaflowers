import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import IntakeForm from "@/components/admin/intake/IntakeForm";
import type { DraftPayload } from "@/types/draft";

const resumePayload: DraftPayload = {
  version: 1,
  channel: "walk-in",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola Resumed", phone: "5165550199" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "resumed msg",
  },
  lines: [],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("IntakeForm drafts wiring", () => {
  it("saves a draft via POST with the current form payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "dr_new", found: false }), { status: 201 }),
    );
    render(<IntakeForm products={[]} />);

    fireEvent.change(screen.getByPlaceholderText("fulfillment_recipient_name_placeholder"), {
      target: { value: "Lola" },
    });
    const saveDraft = screen.getByRole("button", { name: "action_save_draft" });
    fireEvent.click(saveDraft);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([u, i]) => String(u) === "/api/admin/orders/drafts" && (i as RequestInit)?.method === "POST",
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.payload.fulfillment.recipient.name).toBe("Lola");
    });
  });

  it("resumes a draft from the drawer into the form", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/admin/orders/drafts")) {
        return new Response(
          JSON.stringify({ drafts: [{ id: "dr_1", label: "Ana", itemCount: 0, totalCents: 0, createdAt: "2026-07-31T10:00:00Z", updatedAt: "2026-07-31T10:00:00Z" }] }),
          { status: 200 },
        );
      }
      if (url.includes("/api/admin/orders/drafts/dr_1")) {
        return new Response(JSON.stringify({ draft: { id: "dr_1", label: "Ana", itemCount: 0, totalCents: 0, createdAt: "2026-07-31T10:00:00Z", updatedAt: "2026-07-31T10:00:00Z", payload: resumePayload } }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });

    render(<IntakeForm products={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "drafts_button" }));
    await waitFor(() => expect(screen.getByText("Ana")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "draft_resume" }));

    await waitFor(() =>
      expect((screen.getByPlaceholderText("fulfillment_recipient_name_placeholder") as HTMLInputElement).value).toBe("Lola Resumed"),
    );
    expect((screen.getByPlaceholderText("card_message_placeholder") as HTMLTextAreaElement).value).toBe("resumed msg");
  });

  it("disables save-draft until there is content, enables once a recipient is typed", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<IntakeForm products={[]} />);
    expect((screen.getByRole("button", { name: "action_save_draft" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("fulfillment_recipient_name_placeholder"), { target: { value: "Lola" } });
    expect((screen.getByRole("button", { name: "action_save_draft" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("reuses the draft id on a second save (PUT, no duplicate) and shows saved confirmation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method;
      if (url.endsWith("/api/admin/orders/drafts") && method === "POST") {
        return new Response(JSON.stringify({ id: "dr_new", draft: { id: "dr_new" } }), { status: 201 });
      }
      if (url.includes("/api/admin/orders/drafts/dr_new") && method === "PUT") {
        return new Response(JSON.stringify({ draft: { id: "dr_new" } }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    render(<IntakeForm products={[]} />);
    fireEvent.change(screen.getByPlaceholderText("fulfillment_recipient_name_placeholder"), { target: { value: "Lola" } });
    fireEvent.click(screen.getByRole("button", { name: "action_save_draft" }));
    await waitFor(() => expect(screen.getByText("draft_saved")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "action_save_draft" }));
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([u, i]) => String(u).includes("/api/admin/orders/drafts/dr_new") && (i as RequestInit)?.method === "PUT");
      expect(put).toBeTruthy();
    });
  });

  it("shows an error when saving the draft fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }));
    render(<IntakeForm products={[]} />);
    fireEvent.change(screen.getByPlaceholderText("fulfillment_recipient_name_placeholder"), { target: { value: "Lola" } });
    fireEvent.click(screen.getByRole("button", { name: "action_save_draft" }));
    await waitFor(() => expect(screen.getByText("draft_save_failed")).toBeDefined());
  });

  it("recovers when the backing draft was deleted elsewhere (PUT 404 -> fresh POST)", async () => {
    let created = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method;
      if (url.endsWith("/api/admin/orders/drafts") && method === "POST") {
        created += 1;
        const id = created === 1 ? "dr_old" : "dr_new";
        return new Response(JSON.stringify({ id, draft: { id } }), { status: 201 });
      }
      if (url.includes("/api/admin/orders/drafts/dr_old") && method === "PUT") {
        return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
      }
      if (url.includes("/api/admin/orders/drafts/dr_new") && method === "PUT") {
        return new Response(JSON.stringify({ draft: { id: "dr_new" } }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    render(<IntakeForm products={[]} />);
    fireEvent.change(screen.getByPlaceholderText("fulfillment_recipient_name_placeholder"), { target: { value: "Lola" } });

    // first save -> POST -> binds dr_old
    fireEvent.click(screen.getByRole("button", { name: "action_save_draft" }));
    await waitFor(() => expect(screen.getByText("draft_saved")).toBeDefined());

    // second save -> PUT dr_old returns 404 -> should recover via a fresh POST (dr_new)
    fireEvent.click(screen.getByRole("button", { name: "action_save_draft" }));
    await waitFor(() => expect(created).toBe(2)); // a fresh draft was created after the 404
    await waitFor(() => expect(screen.getByText("draft_saved")).toBeDefined());
    expect(screen.queryByText("draft_save_failed")).toBeNull();
    const put404 = fetchMock.mock.calls.find(([u, i]) => String(u).includes("/drafts/dr_old") && (i as RequestInit)?.method === "PUT");
    expect(put404).toBeTruthy();
  });
});
