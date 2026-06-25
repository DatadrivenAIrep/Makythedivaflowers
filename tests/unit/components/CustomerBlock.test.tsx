import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CustomerBlock, { type CustomerSnapshot } from "@/components/admin/intake/CustomerBlock";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
afterEach(() => vi.restoreAllMocks());

const snap: CustomerSnapshot = { name: "", phone: "", email: "", messagingChannel: "sms" };

describe("CustomerBlock buyer address", () => {
  it("pre-fills buyer address from a phone lookup", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      found: true,
      customer: { name: "Juan", email: "j@e.com", orderCount: 2, buyerAddress: { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" } },
    }), { status: 200 }));
    const onChange = vi.fn();
    render(<CustomerBlock value={{ ...snap, phone: "5165550100" }} onChange={onChange} onApplyAddress={() => {}} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      buyerAddress: expect.objectContaining({ street1: "12 Willis Ave" }),
    })));
  });

  it("fires onApplyAddress with the buyer address when 'use as delivery' is clicked", () => {
    const onApply = vi.fn();
    const buyer = { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" as const };
    render(<CustomerBlock value={{ ...snap, buyerAddress: buyer }} onChange={() => {}} onApplyAddress={onApply} />);
    fireEvent.click(screen.getByText("buyer_use_as_delivery"));
    expect(onApply).toHaveBeenCalledWith(buyer);
  });
});
