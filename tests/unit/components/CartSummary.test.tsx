import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CartSummary from "@/components/admin/intake/CartSummary";
import type { CartLine } from "@/types/order";

// next-intl returns the key so we can assert on stable identifiers.
vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));

afterEach(() => vi.restoreAllMocks());

const lines: CartLine[] = [{ kind: "custom", title: "Arreglo", priceCents: 10000, qty: 1 }];

function renderSummary(props: Partial<React.ComponentProps<typeof CartSummary>> = {}) {
  return render(
    <CartSummary
      lines={lines}
      onChangeLines={() => {}}
      fulfillmentMethod="delivery"
      deliveryZip=""
      deliveryCity=""
      override={{}}
      onOverride={() => {}}
      {...props}
    />,
  );
}

describe("CartSummary delivery fee", () => {
  it("prices delivery from an in-zone ZIP", () => {
    renderSummary({ deliveryZip: "11507" }); // Albertson $10
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.queryByText("totals_delivery_unresolved_hint")).not.toBeInTheDocument();
  });

  it("prices delivery from a named city when the ZIP is blank", () => {
    renderSummary({ deliveryCity: "Great Neck" }); // $25
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.queryByText("totals_delivery_unresolved_hint")).not.toBeInTheDocument();
  });

  it("warns instead of charging $0 when the address can't be priced", () => {
    renderSummary({ deliveryZip: "", deliveryCity: "Nowhereville" });
    expect(screen.getByText("totals_delivery_unresolved_hint")).toBeInTheDocument();
    expect(screen.getByText("totals_delivery_unresolved")).toBeInTheDocument();
  });

  it("does not warn for in-store orders (no delivery line)", () => {
    renderSummary({ fulfillmentMethod: "in-store" });
    expect(screen.queryByText("totals_delivery_unresolved_hint")).not.toBeInTheDocument();
  });

  it("respects a manual delivery override over the unresolved state", () => {
    renderSummary({ deliveryCity: "Nowhereville", override: { deliveryCents: 3000 } });
    expect(screen.queryByText("totals_delivery_unresolved_hint")).not.toBeInTheDocument();
    expect(screen.getByText("$30.00")).toBeInTheDocument();
  });
});
