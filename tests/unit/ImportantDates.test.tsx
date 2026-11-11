import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import ImportantDates from "@/components/admin/customers/ImportantDates";
import type { ImportantDate } from "@/lib/customer-dates-storage";
import type { AccountDate } from "@/lib/account-dates";

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
    month: 3, day: 15, source: "admin", createdAt: "2026-07-01T00:00:00Z",
    next: { date: "2027-03-15", daysUntil: 23 },
  },
  {
    id: "d2", customerId: "c1", kind: "anniversary",
    month: 7, day: 4, year: 2010, source: "admin", createdAt: "2026-07-01T00:00:00Z",
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

describe("ImportantDates gustos", () => {
  const withPrefs: AccountDate[] = [
    { ...dates[0], source: "customer", prefs: { flowers: ["roses"], colors: ["pink"], avoid: ["strong_scent"] } },
    { ...dates[1], prefs: { flowers: [], colors: [], avoid: [] } },
  ];

  it("muestra origen, gustos y evitar con la variable encendida", () => {
    wrap(<ImportantDates customerId="c1" initial={withPrefs} locale="es" showPrefs />);
    expect(screen.getByText("Cliente")).toBeDefined();
    expect(screen.getByText("Panel")).toBeDefined();
    expect(screen.getByText(/Rosas/)).toBeDefined();
    expect(screen.getByText(/Evitar: Perfume fuerte/)).toBeDefined();
  });

  it("sin la variable se ve como antes", () => {
    wrap(<ImportantDates customerId="c1" initial={withPrefs} locale="es" />);
    expect(screen.queryByText("Cliente")).toBeNull();
    expect(screen.queryByText(/Evitar:/)).toBeNull();
    expect(screen.queryByText("Editar gustos")).toBeNull();
  });

  it("Editar abre el selector", () => {
    wrap(<ImportantDates customerId="c1" initial={withPrefs} locale="es" showPrefs />);
    fireEvent.click(screen.getAllByText("Editar gustos")[0]);
    expect(screen.getByRole("group", { name: "Flores favoritas" })).toBeDefined();
  });
});

describe("ImportantDates fecha de tarjeta", () => {
  const card: ImportantDate = {
    id: "dc", customerId: "c1", kind: "birthday",
    month: 3, day: 15, year: 1976, source: "card", relationship: "madre",
    sourceOrderId: "o1", sourceOrderNumber: 1234, createdAt: "2026-07-01T00:00:00Z",
    next: { date: "2026-03-15", daysUntil: 10 },
  };

  it("muestra origen, parentesco y edad aunque showPrefs sea falso", () => {
    wrap(<ImportantDates customerId="c1" initial={[card]} locale="es" />);
    expect(screen.getByText("Tarjeta · #1234")).toBeDefined();
    expect(screen.getByText(/mamá/)).toBeDefined();
    expect(screen.getByText(/cumple 50/)).toBeDefined();
  });

  it("con showPrefs una fecha de tarjeta no muestra además el chip Panel", () => {
    wrap(<ImportantDates customerId="c1" initial={[card]} locale="es" showPrefs />);
    expect(screen.getByText("Tarjeta · #1234")).toBeDefined();
    expect(screen.queryByText("Panel")).toBeNull();
  });

  it("el chip abre el pedido", () => {
    const onOpenOrder = vi.fn();
    wrap(<ImportantDates customerId="c1" initial={[card]} locale="es" onOpenOrder={onOpenOrder} />);
    fireEvent.click(screen.getByText("Tarjeta · #1234"));
    expect(onOpenOrder).toHaveBeenCalledWith("o1");
  });

  it("una fecha del panel no muestra el chip de tarjeta", () => {
    wrap(<ImportantDates customerId="c1" initial={dates} locale="es" />);
    expect(screen.queryByText(/Tarjeta/)).toBeNull();
    expect(screen.queryByText(/cumple \d/)).toBeNull();
  });
});
