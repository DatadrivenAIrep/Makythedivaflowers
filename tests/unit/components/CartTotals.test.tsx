import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CartTotals from "@/components/admin/intake/CartTotals";
import type { CartLine } from "@/types/order";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k, useLocale: () => "es" }));

const lines: CartLine[] = [{ kind: "custom", title: "Ramo", priceCents: 5000, qty: 1 }];

describe("CartTotals", () => {
  it("edits a total inline (no window.prompt) and shows a reset control", () => {
    const onOverride = vi.fn();
    const { rerender } = render(
      <CartTotals lines={lines} fulfillmentMethod="in-store" deliveryZip="" deliveryCity="" override={{}} onOverride={onOverride} />,
    );
    // open the subtotal editor (its button shows "$50.00 ✎"), type, commit with Enter
    fireEvent.click(screen.getByRole("button", { name: /\$50\.00/ }));
    const input = screen.getByDisplayValue("50.00");
    fireEvent.change(input, { target: { value: "60.00" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOverride).toHaveBeenCalledWith({ subtotalCents: 6000 });

    // with an override applied, a reset control (↺) appears
    rerender(<CartTotals lines={lines} fulfillmentMethod="in-store" deliveryZip="" deliveryCity="" override={{ subtotalCents: 6000 }} onOverride={onOverride} />);
    expect(screen.getByText("↺")).toBeInTheDocument();
  });

  it("warns instead of charging $0 when the delivery address can't be priced", () => {
    render(<CartTotals lines={lines} fulfillmentMethod="delivery" deliveryZip="" deliveryCity="Nowhereville" override={{}} onOverride={() => {}} />);
    expect(screen.getByText("totals_delivery_unresolved_hint")).toBeInTheDocument();
  });

  it("prices delivery from an in-zone ZIP", () => {
    render(<CartTotals lines={lines} fulfillmentMethod="delivery" deliveryZip="11507" deliveryCity="" override={{}} onOverride={() => {}} />);
    expect(screen.getByRole("button", { name: /\$10\.00/ })).toBeInTheDocument();
    expect(screen.queryByText("totals_delivery_unresolved_hint")).not.toBeInTheDocument();
  });

  it("cascades an overridden subtotal into the total (bug fix)", () => {
    // subtotal override 10000 → tax Math.round(10000*0.08625)=862 (float) → total 10862 = $108.62
    render(<CartTotals lines={lines} fulfillmentMethod="in-store" deliveryZip="" deliveryCity="" override={{ subtotalCents: 10000 }} onOverride={() => {}} />);
    expect(screen.getByRole("button", { name: /\$108\.62/ })).toBeInTheDocument();
  });
});
