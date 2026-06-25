import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FulfillmentBlock, { type FulfillmentState } from "@/components/admin/intake/FulfillmentBlock";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

function state(method: FulfillmentState["method"]): FulfillmentState {
  return {
    method,
    recipient: { name: "Maria", phone: "555" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2026-07-04", slot: "midday" },
    cardMessage: "",
  };
}

describe("FulfillmentBlock card message", () => {
  it("renders an editable card-message field for delivery", () => {
    const onChange = vi.fn();
    render(<FulfillmentBlock value={state("delivery")} onChange={onChange} />);
    const ta = screen.getByPlaceholderText("card_message_placeholder");
    fireEvent.change(ta, { target: { value: "Feliz cumple" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cardMessage: "Feliz cumple" }));
  });

  it("renders the card-message field even for in-store", () => {
    render(<FulfillmentBlock value={state("in-store")} onChange={() => {}} />);
    expect(screen.getByPlaceholderText("card_message_placeholder")).toBeInTheDocument();
  });
});
