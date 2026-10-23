import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConversationContext from "@/components/admin/messages/ConversationContext";

// Echo interpolated values so assertions can tell links apart.
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) =>
    v ? `${k} ${Object.values(v).join(" ")}` : k,
}));

let fetchMock: ReturnType<typeof vi.fn>;
function mockLookup(body: unknown) {
  // A fresh Response per call: a body can only be read once.
  fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
}
afterEach(() => vi.unstubAllGlobals());

const mama = {
  name: "Mamá", phone: "5165559999", orderCount: 3, lastDate: "2026-06-01", lastOrderId: "o1", addresses: [],
  lastAddress: { street1: "9 Tulip Ct", city: "Bayville", state: "NY", zip: "11709", country: "US" },
};

describe("ConversationContext", () => {
  it("shows the customer, a new-order link, and per-recipient order links", async () => {
    const recipients = [
      mama,
      { ...mama, name: "Sofía", phone: "5165558888", orderCount: 1 },
      { ...mama, name: "R2", phone: "5165550002" },
      { ...mama, name: "R3", phone: "5165550003" },
      { ...mama, name: "R4", phone: "5165550004" },
    ];
    mockLookup({
      found: true,
      customer: { id: "cus_1", name: "Ana López", phone: "5165550100", orderCount: 7, lastSeenAt: new Date().toISOString() },
      recipients,
      asRecipient: null,
    });
    render(<ConversationContext locale="es" phone="+1 (516) 555-0100" />);

    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/customers/lookup?phone=5165550100");
    expect(screen.getByText(/ctx_orders_other 7/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /ctx_new_order$/ })).toHaveAttribute(
      "href", "/es/admin/intake?phone=5165550100",
    );
    expect(screen.getByRole("link", { name: /ctx_view_profile/ })).toHaveAttribute(
      "href", "/es/admin/customers/cus_1",
    );
    expect(screen.getByRole("link", { name: "ctx_new_order_for Mamá" })).toHaveAttribute(
      "href", "/es/admin/intake?phone=5165550100&rphone=5165559999&rname=Mam%C3%A1",
    );
    expect(screen.getByRole("link", { name: "ctx_new_order_for Sofía" })).toHaveAttribute(
      "href", "/es/admin/intake?phone=5165550100&rphone=5165558888&rname=Sof%C3%ADa",
    );

    // Top 4 only until "show more".
    expect(screen.queryByRole("link", { name: "ctx_new_order_for R4" })).toBeNull();
    fireEvent.click(screen.getByText("ctx_show_more 1"));
    expect(screen.getByRole("link", { name: "ctx_new_order_for R4" })).toBeInTheDocument();
  });

  it("recognizes a number that has only received flowers", async () => {
    mockLookup({
      found: false,
      recipients: [],
      asRecipient: {
        name: "Carmen", phone: "5165550100", orderCount: 2, lastDate: "2026-06-01", addresses: [],
        senders: [{ name: "Luis", phone: "5165550200", orderCount: 2 }],
      },
    });
    render(<ConversationContext locale="en" phone="5165550100" />);

    expect(await screen.findByText("Carmen")).toBeInTheDocument();
    expect(screen.getByText("ctx_received_other 2 Luis")).toBeInTheDocument();
    expect(screen.queryByText(/ctx_view_profile/)).toBeNull();
    expect(screen.getByRole("link", { name: /ctx_new_order$/ })).toHaveAttribute(
      "href", "/en/admin/intake?phone=5165550100",
    );
  });

  it("marks an unknown number as new and still offers a new order", async () => {
    mockLookup({ found: false, recipients: [], asRecipient: null });
    render(<ConversationContext locale="es" phone="15165550100" />);

    expect(await screen.findByText("ctx_new_number")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ctx_new_order$/ })).toHaveAttribute(
      "href", "/es/admin/intake?phone=5165550100",
    );
    expect(screen.queryByRole("button", { name: /ctx_show_details/ })).toBeNull();
  });
});
