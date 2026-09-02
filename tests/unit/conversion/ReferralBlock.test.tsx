import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReciprocityCard } from "@/components/conversion/ReciprocityCard";
import type { Order } from "@/types/order";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "do_1",
    source: "web",
    locale: "es",
    lines: [],
    fulfillment: {
      method: "pickup",
      recipient: { name: "X", phone: "5165550100" },
      window: { date: "2026-09-09", slot: "midday" },
    },
    contact: { phone: "5165550100" },
    totals: {
      subtotalCents: 20000,
      deliveryCents: 0,
      discountCents: 0,
      tipCents: 0,
      taxCents: 1725,
      totalCents: 21725,
    },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-09-02T10:00:00Z",
    updatedAt: "2026-09-02T10:00:00Z",
    ...over,
  }) as Order;

describe("the referral block on the confirmation page", () => {
  it("shows the code the buyer can share", () => {
    render(<ReciprocityCard order={order()} locale="es" referralCode="AMIGA-K7QT" />);
    expect(screen.getByText("AMIGA-K7QT")).toBeInTheDocument();
  });

  it("stays hidden when there is no code to give", () => {
    // Better silent than promising a reward with nothing behind it — which is
    // exactly what this block used to do.
    render(<ReciprocityCard order={order()} locale="es" />);
    expect(screen.queryByText(/referral_title/)).not.toBeInTheDocument();
  });

  // Note: the card also skips the subscription nudge for a buyer who just
  // subscribed, but no product carries category "subscriptions" today — that
  // branch is unreachable and is not asserted here.
  it("still offers the subscription nudge without a code", () => {
    render(<ReciprocityCard order={order()} locale="es" />);
    expect(screen.getByText("subscription_title")).toBeInTheDocument();
  });

});
