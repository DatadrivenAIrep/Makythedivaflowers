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
});
