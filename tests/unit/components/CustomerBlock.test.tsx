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
    render(<CustomerBlock value={{ ...snap, phone: "5165550100" }} onChange={onChange} onApplyAddress={() => {}} onPickRecipient={() => {}} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      buyerAddress: expect.objectContaining({ street1: "12 Willis Ave" }),
    })));
  });

  it("fires onApplyAddress with the buyer address when 'use as delivery' is clicked", () => {
    const onApply = vi.fn();
    const buyer = { street1: "12 Willis Ave", city: "Albertson", state: "NY", zip: "11507", country: "US" as const };
    render(<CustomerBlock value={{ ...snap, buyerAddress: buyer }} onChange={() => {}} onApplyAddress={onApply} onPickRecipient={() => {}} />);
    fireEvent.click(screen.getByText("buyer_use_as_delivery"));
    expect(onApply).toHaveBeenCalledWith(buyer);
  });
});

describe("CustomerBlock recipients", () => {
  const mama = {
    name: "Mamá", phone: "5165559999", orderCount: 3, lastDate: "2026-06-01", lastOrderId: "o1",
    lastAddress: { street1: "9 Tulip Ct", city: "Bayville", state: "NY", zip: "11709", country: "US" as const },
  };

  it("lists the sender's past recipients and hands the picked one up", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      found: true,
      customer: { name: "Juan", orderCount: 3 },
      recipients: [mama, { ...mama, name: "Sofía", phone: "5165558888", orderCount: 1 }],
      asRecipient: null,
    }), { status: 200 }));
    const onPick = vi.fn();
    render(<CustomerBlock value={{ ...snap, phone: "5165550100" }} onChange={() => {}} onApplyAddress={() => {}} onPickRecipient={onPick} />);
    await waitFor(() => expect(screen.getByText("known_recipients_label")).toBeDefined());
    expect(screen.getByText("Bayville · ×3")).toBeDefined();
    fireEvent.click(screen.getByText("Mamá"));
    expect(onPick).toHaveBeenCalledWith(mama);
  });

  it("collapses a long list behind 'show more'", async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...mama, name: `R${i}`, phone: `516555000${i}` }));
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      found: false, recipients: many, asRecipient: null,
    }), { status: 200 }));
    render(<CustomerBlock value={{ ...snap, phone: "5165550100" }} onChange={() => {}} onApplyAddress={() => {}} onPickRecipient={() => {}} />);
    await waitFor(() => expect(screen.getByText("R3")).toBeDefined());
    expect(screen.queryByText("R4")).toBeNull();
    fireEvent.click(screen.getByText("known_recipients_more"));
    expect(screen.getByText("R5")).toBeDefined();
  });

  it("recognizes a caller who has only received flowers and reuses their name", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      found: false, recipients: [],
      asRecipient: { name: "Carmen", phone: "5165550100", orderCount: 2, lastDate: "2026-06-01", senders: [{ name: "Luis", phone: "5165550200", orderCount: 2 }] },
    }), { status: 200 }));
    const onChange = vi.fn();
    render(<CustomerBlock value={{ ...snap, phone: "5165550100" }} onChange={onChange} onApplyAddress={() => {}} onPickRecipient={() => {}} />);
    await waitFor(() => expect(screen.getByText("caller_received_other")).toBeDefined());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Carmen" }));
  });
});

describe("CustomerBlock message language", () => {
  it("starts in English and lets staff switch to Español", () => {
    const onChange = vi.fn();
    render(<CustomerBlock value={{ ...snap, locale: "en" }} onChange={onChange} onApplyAddress={() => {}} onPickRecipient={() => {}} />);
    expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Español" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ locale: "es" }));
  });

  it("adopts a returning customer's saved language", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      found: true, customer: { name: "Juan", orderCount: 2, locale: "es" }, recipients: [], asRecipient: null,
    }), { status: 200 }));
    const onChange = vi.fn();
    render(<CustomerBlock value={{ ...snap, phone: "5165550100", locale: "en" }} onChange={onChange} onApplyAddress={() => {}} onPickRecipient={() => {}} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ locale: "es" })));
  });

  it("keeps a language staff picked by hand when the lookup comes back", async () => {
    let resolve!: (r: Response) => void;
    vi.spyOn(global, "fetch").mockReturnValue(new Promise<Response>((r) => { resolve = r; }));
    const onChange = vi.fn();
    const { rerender } = render(
      <CustomerBlock value={{ ...snap, phone: "5165550100", locale: "en" }} onChange={onChange} onApplyAddress={() => {}} onPickRecipient={() => {}} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "English" })); // explicit pick
    rerender(<CustomerBlock value={{ ...snap, phone: "5165550100", locale: "en" }} onChange={onChange} onApplyAddress={() => {}} onPickRecipient={() => {}} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    resolve(new Response(JSON.stringify({ found: true, customer: { name: "Juan", orderCount: 2, locale: "es" }, recipients: [], asRecipient: null }), { status: 200 }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "Juan" })));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ locale: "en" }));
  });
});
