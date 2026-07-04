import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import CustomersList from "@/components/admin/customers/CustomersList";
import type { CustomerListResult } from "@/lib/customer-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const initial: CustomerListResult = {
  customers: [
    {
      id: "ana", name: "Ana Flores", phone: "5165550001",
      orderCount: 6, firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-07-01T00:00:00Z",
      tags: ["boda"],
      metrics: {
        ltvCents: 36000, orderCount: 6, paidOrderCount: 6, aovCents: 6000,
        firstOrderAt: "2026-01-01T00:00:00Z", lastOrderAt: "2026-07-01T00:00:00Z",
        daysSinceLastOrder: 3, segment: "vip", isVip: true, isAtRisk: false, isRecurring: true,
      },
    },
    {
      id: "bob", name: "Bob Marchetti", phone: "5165550002",
      orderCount: 2, firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-03-01T00:00:00Z",
      tags: [],
      metrics: {
        ltvCents: 16000, orderCount: 2, paidOrderCount: 2, aovCents: 8000,
        firstOrderAt: "2026-01-01T00:00:00Z", lastOrderAt: "2026-03-01T00:00:00Z",
        daysSinceLastOrder: 125, segment: "at_risk", isVip: false, isAtRisk: true, isRecurring: true,
      },
    },
  ],
  stats: { total: 2, newThisMonth: 1, repeatRatePct: 100, atRiskCount: 1 },
  nextCursor: null,
};

describe("CustomersList", () => {
  it("renders stats, segment chips, and customer rows with metrics", () => {
    wrap(<CustomersList locale="es" initial={initial} allTags={["boda"]} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByText("Bob Marchetti")).toBeDefined();
    expect(screen.getByText("$360.00")).toBeDefined();          // ana LTV
    expect(screen.getByText("Nuevos este mes")).toBeDefined();  // stats strip
    expect(screen.getByText("Todos")).toBeDefined();            // segment chip
    // "VIP" and "En riesgo" appear both as filter chips and as row badges/stat
    // labels, so assert on counts, not uniqueness:
    expect(screen.getAllByText("VIP").length).toBeGreaterThanOrEqual(2);       // chip + ana badge
    expect(screen.getAllByText("En riesgo").length).toBeGreaterThanOrEqual(2); // chip + bob badge + stat label
  });

  it("links each row to the customer profile", () => {
    wrap(<CustomersList locale="es" initial={initial} allTags={[]} />);
    const link = screen.getByRole("link", { name: /Ana Flores/ });
    expect(link.getAttribute("href")).toBe("/es/admin/customers/ana");
  });
});
