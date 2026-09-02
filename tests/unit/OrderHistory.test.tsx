import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { OrderHistory } from "@/components/account/OrderHistory";
import { PRODUCTS } from "@/data/products";
import type { Order } from "@/types/order";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (k: string) => k,
}));
vi.mock("@/components/account/SignOutButton", () => ({
  SignOutButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

const product = PRODUCTS.find((p) => p.active && !p.giftExtra && !p.quoteOnly)!;

const order = (over: Partial<Order> = {}): Order => ({
  id: "do_1",
  orderNumber: 1042,
  source: "web",
  locale: "en",
  lines: [
    { kind: "catalog", productId: product.id, variantId: product.variants[0].id, addOnIds: [], qty: 2 },
  ],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550101" },
    address: { street1: "1 Main St", city: "Roslyn", state: "NY", zip: "11576", country: "US" },
    window: { date: "2026-05-03", slot: "midday" },
  },
  contact: { phone: "5165550100", email: "a@b.com" },
  totals: {
    subtotalCents: 20000,
    deliveryCents: 1500,
    discountCents: 0,
    tipCents: 0,
    taxCents: 1854,
    totalCents: 23354,
  },
  status: "delivered",
  paymentStatus: "paid",
  createdAt: "2026-05-02T12:00:00Z",
  updatedAt: "2026-05-02T12:00:00Z",
  ...over,
});

async function renderHistory(orders: Order[]) {
  render(await OrderHistory({ orders, locale: "en" }));
}

describe("OrderHistory", () => {
  it("shows what was ordered, not just a receipt line", async () => {
    await renderHistory([order()]);
    const item = screen.getByRole("article");
    expect(within(item).getByText(new RegExp(product.title.en))).toBeInTheDocument();
    expect(item.textContent).toContain("2 ×");
  });

  it("shows the order number and what it cost", async () => {
    await renderHistory([order()]);
    const item = screen.getByRole("article");
    expect(item.textContent).toContain("#1042");
    expect(item.textContent).toContain("$233.54");
  });

  it("offers a one-click way to send the same thing again", async () => {
    // Repeat gifting is most of a florist's revenue; this link is the point of
    // the whole page.
    await renderHistory([order()]);
    const again = screen.getByRole("link", { name: /order_again/ });
    expect(again).toHaveAttribute("href", `/en/product/${product.slug}`);
  });

  it("names the town it went to", async () => {
    await renderHistory([order()]);
    expect(screen.getByRole("article").textContent).toContain("Roslyn");
  });

  it("says so when it was picked up instead", async () => {
    await renderHistory([
      order({
        fulfillment: {
          method: "pickup",
          recipient: { name: "Lola", phone: "5165550101" },
          window: { date: "2026-05-03", slot: "midday" },
        },
      }),
    ]);
    expect(screen.getByRole("article").textContent).toContain("picked_up");
  });

  it("lists several orders", async () => {
    await renderHistory([order(), order({ id: "do_2", orderNumber: 1043 })]);
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("survives an order whose product has since left the catalog", async () => {
    // Retired products are removed from data/products.ts; an old order must
    // still render rather than crash the page.
    await renderHistory([
      order({
        lines: [{ kind: "catalog", productId: "p-gone", variantId: "standard", addOnIds: [], qty: 1 }],
      }),
    ]);
    expect(screen.getByRole("article").textContent).toContain("#1042");
  });
});
