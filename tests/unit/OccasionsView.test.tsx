import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import OccasionsView from "@/components/admin/occasions/OccasionsView";
import type { UpcomingOccasion } from "@/lib/customer-dates-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const occasions: UpcomingOccasion[] = [
  {
    dateId: "d1", customerId: "c1", customerName: "Ana Flores", phone: "5165550001",
    kind: "birthday", label: "esposa María", next: { date: "2026-07-04", daysUntil: 0 },
  },
  {
    dateId: "d2", customerId: "c2", customerName: "Bob Marchetti", phone: "5165550002",
    kind: "anniversary", next: { date: "2026-07-07", daysUntil: 3 },
  },
];

describe("OccasionsView", () => {
  it("renders urgency chips, kinds, labels, and profile links", () => {
    wrap(<OccasionsView locale="es" initial={occasions} />);
    expect(screen.getByText("HOY")).toBeDefined();
    expect(screen.getByText("en 3 días")).toBeDefined();
    expect(screen.getByText(/esposa María/)).toBeDefined();
    expect(screen.getByText("Próximos 7 días")).toBeDefined();
    const link = screen.getByRole("link", { name: "Ana Flores" });
    expect(link.getAttribute("href")).toBe("/es/admin/customers/c1");
  });

  it("shows the empty state", () => {
    wrap(<OccasionsView locale="es" initial={[]} />);
    expect(screen.getByText("No hay ocasiones en este rango.")).toBeDefined();
  });
});
