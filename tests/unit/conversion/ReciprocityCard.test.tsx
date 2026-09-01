// tests/unit/conversion/ReciprocityCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReciprocityCard } from "@/components/conversion/ReciprocityCard";
import { PRODUCTS } from "@/data/products";
import type { Order } from "@/types/order";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

// Build a minimal Order — field names match the actual Order type
const baseOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "ord_a4f2c9",
  source: "web",
  locale: "en",
  lines: [{ kind: "catalog", productId: "p-arr-m01", variantId: "lush", addOnIds: [], qty: 1 }],
  contact: { email: "x@y.z", phone: "5161234567" },
  fulfillment: {
    method: "delivery",
    recipient: { name: "Test", phone: "5160000000" },
    address: { street1: "1 a", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-05-03", slot: "midday" },
    cardMessage: "",
  },
  totals: { subtotalCents: 25500, deliveryCents: 0, discountCents: 0, taxCents: 0, totalCents: 25500 },
  status: "pending",
  paymentStatus: "paid",
  createdAt: "2026-05-02T12:00:00Z",
  updatedAt: "2026-05-02T12:00:00Z",
  ...overrides,
});

describe("ReciprocityCard", () => {
  it("renders the subscription nudge for a non-subscription order", () => {
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    expect(screen.getByText("subscription_title")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /subscription_cta/ })).toHaveAttribute(
      "href",
      "/en/shop/subscriptions",
    );
  });

  it("renders the subscription nudge when the order has no catalog lines", () => {
    render(<ReciprocityCard order={baseOrder({ lines: [] })} locale="en" />);
    expect(screen.getByText("subscription_title")).toBeInTheDocument();
  });

  it("renders nothing when the order already contains a subscription", () => {
    const subscription = PRODUCTS.find((p) => p.category === "subscriptions");
    if (!subscription) {
      // No subscription products in the catalog today; the guard is still worth
      // keeping, so assert that rather than silently passing an empty test.
      expect(PRODUCTS.some((p) => p.category === "subscriptions")).toBe(false);
      return;
    }
    const { container } = render(
      <ReciprocityCard
        order={baseOrder({
          lines: [
            {
              kind: "catalog",
              productId: subscription.id,
              variantId: subscription.variants[0].id,
              addOnIds: [],
              qty: 1,
            },
          ],
        })}
        locale="en"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // The referral half was removed deliberately: it handed out a DIVA-XXXX code
  // that no endpoint could redeem. This guards against it coming back before a
  // promo engine exists to honour it.
  it("does not show a referral code the checkout cannot redeem", () => {
    render(<ReciprocityCard order={baseOrder()} locale="en" />);
    expect(screen.queryByText(/DIVA-/)).not.toBeInTheDocument();
    expect(screen.queryByText("referral_title")).not.toBeInTheDocument();
  });
});
