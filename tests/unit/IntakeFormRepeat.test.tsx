import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k} ${JSON.stringify(v)}` : k),
  useLocale: () => "es",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import IntakeForm from "@/components/admin/intake/IntakeForm";
import type { RepeatedOrder } from "@/lib/repeat-order";

const repeat: RepeatedOrder = {
  payload: {
    version: 1,
    channel: "phone",
    customer: { name: "Ana Pérez", phone: "5165550100", email: "", messagingChannel: "sms", locale: "es" },
    fulfillment: {
      method: "delivery",
      recipient: { name: "Iglesia San José", phone: "5165550199" },
      address: { street1: "1 Main St", city: "Albertson", state: "NY", zip: "11507", country: "US" },
      window: { date: "2026-10-16", slot: "midday" },
      cardMessage: "",
      funeral: false,
    },
    lines: [],
    override: {},
    giftCardCode: "",
    payment: { status: "pending" },
  },
  from: { id: "ord_1", orderNumber: 1234, createdAt: "2026-10-03T15:00:00Z" },
  previousCardMessage: "Feliz cumpleaños, mamá",
  dropped: [{ en: "Santa's Garden", es: "Jardín de Santa" }],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
});

describe("IntakeForm repeating an order", () => {
  it("starts from the order and says which one", () => {
    render(<IntakeForm products={[]} repeat={repeat} />);
    expect(screen.getByText(/repeat_banner .*#1234/)).toBeDefined();
    expect(screen.getByText(/repeat_dropped .*Jardín de Santa/)).toBeDefined();
    expect(screen.getByDisplayValue("Iglesia San José")).toBeDefined();
    expect(screen.getByDisplayValue("1 Main St")).toBeDefined();
  });

  it("offers last time's card message instead of copying it", () => {
    render(<IntakeForm products={[]} repeat={repeat} />);
    expect(screen.queryByDisplayValue("Feliz cumpleaños, mamá")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "card_message_use_previous" }));
    expect(screen.getByDisplayValue("Feliz cumpleaños, mamá")).toBeDefined();
    expect(screen.queryByRole("button", { name: "card_message_use_previous" })).toBeNull();
  });

  it("tells staff when the order to repeat was not found", () => {
    render(<IntakeForm products={[]} repeatMissing />);
    expect(screen.getByText("repeat_missing")).toBeDefined();
  });
});
