import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderSummaryPanel } from "@/components/checkout/OrderSummaryPanel";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const items = [
  { id: "a", name: "Blush Enchantment", image: "/products/blush-enchantment.jpg", price: 12500, qty: 1 },
  { id: "b", name: "Timeless Romance", image: "/products/timeless-romance.jpg", price: 18000, qty: 2 },
];

describe("OrderSummaryPanel", () => {
  it("renders an eyebrow and each line item", () => {
    render(<OrderSummaryPanel items={items} subtotal={48500} delivery={1500} total={50000} locale="en" />);
    expect(screen.getByText(/your order/i)).toBeInTheDocument();
    expect(screen.getByText("Blush Enchantment")).toBeInTheDocument();
    expect(screen.getByText("Timeless Romance")).toBeInTheDocument();
  });

  it("renders subtotal, delivery, and total labels", () => {
    render(<OrderSummaryPanel items={items} subtotal={48500} delivery={1500} total={50000} locale="en" />);
    expect(screen.getByText(/subtotal/i)).toBeInTheDocument();
    expect(screen.getByText(/delivery/i)).toBeInTheDocument();
    expect(screen.getAllByText(/total/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders formatted prices for line items and total", () => {
    render(<OrderSummaryPanel items={items} subtotal={48500} delivery={1500} total={50000} locale="en" />);
    // Blush: $125, Timeless×2: $360, total: $500
    expect(screen.getByText("$125")).toBeInTheDocument();
    expect(screen.getByText("$360")).toBeInTheDocument();
    expect(screen.getByText("$500")).toBeInTheDocument();
  });

  it("renders a custom eyebrow", () => {
    render(<OrderSummaryPanel items={[]} subtotal={0} delivery={0} total={0} locale="en" eyebrow="Gift summary" />);
    expect(screen.getByText(/gift summary/i)).toBeInTheDocument();
  });
});
