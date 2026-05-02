// tests/unit/conversion/ReciprocityCard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReciprocityCard } from "@/components/conversion/ReciprocityCard";
import type { Order } from "@/types/order";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

// Build a minimal Order — field names match the actual Order type
// Note: no products in data/products.ts have category: "subscriptions",
// so hasSubscription is always false and the subscription nudge always renders.
const baseOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "ord_a4f2c9",
  locale: "en",
  lines: [{ productId: "p-arr-m01", variantId: "lush", addOnIds: [], qty: 1 }],
  contact: { email: "x@y.z", phone: "5161234567" },
  delivery: {
    recipient: { name: "Test", phone: "5160000000" },
    address: { street1: "1 a", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-05-03", slot: "midday" },
    cardMessage: "",
  },
  totals: { subtotalCents: 25500, deliveryCents: 0, taxCents: 0, totalCents: 25500 },
  status: "paid",
  createdAt: "2026-05-02T12:00:00Z",
  ...overrides,
});


describe("ReciprocityCard", () => {
  it("renders the referral code derived from order id", () => {
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    expect(screen.getByText("DIVA-A4F2C9")).toBeInTheDocument();
  });

  it("renders the subscription nudge for a non-subscription order", () => {
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    expect(screen.getByText("subscription_title")).toBeInTheDocument();
  });

  // No products in data/products.ts have category: "subscriptions",
  // so the subscription nudge always shows. This test confirms the nudge
  // is visible even with an empty lines array (no subscription products present).
  it("renders the subscription nudge when lines array is empty (no subscription products exist)", () => {
    render(<ReciprocityCard order={baseOrder({ lines: [] })} locale="en" />);
    expect(screen.getByText("subscription_title")).toBeInTheDocument();
  });

  it("copies the referral code to clipboard on click", async () => {
    // userEvent.setup() installs its own clipboard stub on window.navigator.clipboard.
    // Spy on that stub so the component's navigator.clipboard.writeText() call is tracked.
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    await user.click(screen.getByRole("button", { name: /referral_copy_cta/ }));
    expect(writeTextSpy).toHaveBeenCalledWith("DIVA-A4F2C9");
    writeTextSpy.mockRestore();
  });
});
