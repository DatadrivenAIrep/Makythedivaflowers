import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import RunSheetList from "@/components/admin/dashboard/RunSheetList";
import type { Order } from "@/types/order";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

// city is deliberately NOT a zone label so the zone chip text stays unique
function deliveryOrder(id: string, name: string, zip: string): Order {
  return {
    id, source: "web", locale: "es", lines: [],
    fulfillment: {
      method: "delivery",
      recipient: { name, phone: "5551234567" },
      address: { street1: "1 Main St", city: "Elsewhere", state: "NY", zip, country: "US" },
      window: { date: "2026-07-04", slot: "midday" },
    },
    contact: { phone: "5551234567" },
    totals: { subtotalCents: 5000, deliveryCents: 1000, taxCents: 0, totalCents: 6000 },
    status: "pending", paymentStatus: "paid",
    createdAt: "2026-07-04T00:00:00Z", updatedAt: "2026-07-04T00:00:00Z",
  };
}

describe("RunSheetList", () => {
  it("orders deliveries within a slot by zone (nearer first), even if given farther-first", () => {
    const orders = [
      deliveryOrder("u", "Reci Uno", "11020"), // Great Neck, index 3 (farther)
      deliveryOrder("d", "Reci Dos", "11507"), // Albertson, index 0 (nearer)
    ];
    const { container } = wrap(
      <RunSheetList orders={orders} locale="es" onOpen={() => {}} onAdvance={() => {}} />,
    );
    const text = container.textContent ?? "";
    expect(text.indexOf("Reci Dos")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("Reci Dos")).toBeLessThan(text.indexOf("Reci Uno"));
    // zone chips render, one per card
    expect(screen.getByText("Albertson")).toBeDefined();
    expect(screen.getByText("Great Neck")).toBeDefined();
  });

  it("renders a Directions button linking to Google Maps directions mode", () => {
    wrap(
      <RunSheetList
        orders={[deliveryOrder("d", "Reci Dos", "11507")]}
        locale="es"
        onOpen={() => {}}
        onAdvance={() => {}}
      />,
    );
    const link = screen.getByRole("link", { name: /Cómo llegar/i });
    const href = link.getAttribute("href") ?? "";
    expect(href).toContain("https://www.google.com/maps/dir/?api=1&destination=");
    expect(href).toContain(encodeURIComponent("1 Main St, Elsewhere, NY 11507"));
  });
});
