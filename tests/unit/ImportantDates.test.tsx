import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import ImportantDates from "@/components/admin/customers/ImportantDates";
import type { ImportantDate } from "@/lib/customer-dates-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const dates: ImportantDate[] = [
  {
    id: "d1", customerId: "c1", kind: "birthday", label: "esposa María",
    month: 3, day: 15, createdAt: "2026-07-01T00:00:00Z",
    next: { date: "2027-03-15", daysUntil: 23 },
  },
  {
    id: "d2", customerId: "c1", kind: "anniversary",
    month: 7, day: 4, year: 2010, createdAt: "2026-07-01T00:00:00Z",
    next: { date: "2026-07-04", daysUntil: 0 },
  },
];

describe("ImportantDates", () => {
  it("renders rows with kind, label, urgency chip, and the add form", () => {
    wrap(<ImportantDates customerId="c1" initial={dates} locale="es" />);
    expect(screen.getByText("Fechas importantes")).toBeDefined();
    // "Cumpleaños" appears in the birthday row AND the kind <select> option
    // (same collision the CustomersList tests handle with getAllByText).
    expect(screen.getAllByText("Cumpleaños").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/esposa María/)).toBeDefined();
    expect(screen.getByText("en 23 días")).toBeDefined();
    expect(screen.getByText("HOY")).toBeDefined();
    expect(screen.getByText("Añadir fecha")).toBeDefined();
  });

  it("shows the empty state when there are no dates", () => {
    wrap(<ImportantDates customerId="c1" initial={[]} locale="es" />);
    expect(screen.getByText("Sin fechas guardadas.")).toBeDefined();
  });
});
