import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";
import CartTotals from "@/components/admin/intake/CartTotals";

describe("CartTotals exempt", () => {
  it("shows $0.00 · exento for tax and a tax-free total", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <CartTotals lines={[{ kind: "custom", title: "Altar", priceCents: 5000, qty: 1 }]} fulfillmentMethod="pickup"
          deliveryZip="" deliveryCity="" override={{}} onOverride={() => {}} taxExempt />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("$0.00 · exento")).toBeTruthy();
    expect(screen.getAllByText(/\$50\.00/).length).toBeGreaterThanOrEqual(2); // subtotal + total
  });

  it("shows a read-only tip row when the edited order carries a tip", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <CartTotals lines={[{ kind: "custom", title: "Altar", priceCents: 5000, qty: 1 }]} fulfillmentMethod="pickup"
          deliveryZip="" deliveryCity="" override={{}} onOverride={() => {}} taxExempt baseTipCents={300} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Propina")).toBeTruthy();
    expect(screen.getByText("$3.00")).toBeTruthy();
  });

  it("shows no tip row without a tip", () => {
    render(
      <NextIntlClientProvider locale="es" messages={es}>
        <CartTotals lines={[{ kind: "custom", title: "Altar", priceCents: 5000, qty: 1 }]} fulfillmentMethod="pickup"
          deliveryZip="" deliveryCity="" override={{}} onOverride={() => {}} taxExempt />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText("Propina")).toBeNull();
  });
});
