// tests/unit/conversion/CartUpsellStrip.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartUpsellStrip } from "@/components/conversion/CartUpsellStrip";
import { useCartStore } from "@/lib/cart-store";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, vars?: Record<string, unknown>) => vars ? `${k}|${JSON.stringify(vars)}` : k,
}));

beforeEach(() => {
  useCartStore.setState({ lines: [] });
});

describe("CartUpsellStrip", () => {
  it("renders nothing when cart is empty", () => {
    const { container } = render(<CartUpsellStrip locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders chips for suggested extras when cart has a romance product", () => {
    useCartStore.setState({
      lines: [{ productId: "p-arr-m01", variantId: "lush", addOnIds: [], qty: 1 }],
    });
    render(<CartUpsellStrip locale="en" />);
    expect(screen.getByText(/title/)).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("adds an extra to the cart when chip clicked", async () => {
    useCartStore.setState({
      lines: [{ productId: "p-arr-m01", variantId: "lush", addOnIds: [], qty: 1 }],
    });
    const user = userEvent.setup();
    render(<CartUpsellStrip locale="en" />);
    const firstChip = screen.getAllByRole("button")[0];
    await user.click(firstChip);
    const lines = useCartStore.getState().lines;
    expect(lines.some((l) => l.productId.startsWith("x-"))).toBe(true);
  });
});
