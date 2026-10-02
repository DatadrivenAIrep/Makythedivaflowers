import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CartLines from "@/components/admin/intake/CartLines";
import type { CartLine } from "@/types/order";
import { PRODUCTS } from "@/data/products";

vi.mock("next-intl", () => ({ useLocale: () => "es" }));

describe("CartLines", () => {
  it("renders a custom line with its total and removes it on ✕", () => {
    const lines: CartLine[] = [{ kind: "custom", title: "Arreglo", priceCents: 10000, qty: 2 }];
    const onChange = vi.fn();
    render(<CartLines lines={lines} onChangeLines={onChange} />);
    expect(screen.getByText("Arreglo")).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows which size a multi-size catalog line was added at", () => {
    const lines: CartLine[] = [
      { kind: "catalog", productId: "p-bou-b3-15", variantId: "grand", addOnIds: [], qty: 1 },
    ];
    render(<CartLines lines={lines} onChangeLines={() => {}} />);
    expect(screen.getByText(/El Ramo de Talita/)).toBeInTheDocument();
    expect(screen.getByText(/Grande/)).toBeInTheDocument();
    const cents = PRODUCTS.find((p) => p.id === "p-bou-b3-15")!
      .variants.find((v) => v.id === "grand")!.priceCents;
    expect(screen.getByText(`$${(cents / 100).toFixed(2)}`)).toBeInTheDocument();
  });

  it("shows an empty state with no lines", () => {
    render(<CartLines lines={[]} onChangeLines={() => {}} />);
    expect(screen.getByText(/Sin productos/)).toBeInTheDocument();
  });
});
