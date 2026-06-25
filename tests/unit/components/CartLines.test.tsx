import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CartLines from "@/components/admin/intake/CartLines";
import type { CartLine } from "@/types/order";

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

  it("shows an empty state with no lines", () => {
    render(<CartLines lines={[]} onChangeLines={() => {}} />);
    expect(screen.getByText(/Sin productos/)).toBeInTheDocument();
  });
});
