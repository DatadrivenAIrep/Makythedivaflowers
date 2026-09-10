import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import CustomerProfile from "@/components/admin/customers/CustomerProfile";
import type { CustomerProfileData } from "@/lib/customer-profile";
import type { Order } from "@/types/order";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const order: Order = {
  id: "do_abc123", orderNumber: 1001, source: "walk-in", locale: "es", customerId: "c1",
  lines: [{ kind: "custom", title: "Ramo grande", priceCents: 6000, qty: 1 }],
  fulfillment: { method: "in-store", recipient: { name: "Ana", phone: "5551" } },
  contact: { name: "Ana", phone: "5551" },
  totals: { subtotalCents: 6000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 6000 },
  status: "delivered", paymentStatus: "paid", amountPaidCents: 6000,
  createdAt: "2026-06-30T10:00:00Z", updatedAt: "2026-06-30T10:00:00Z",
};

const profile: CustomerProfileData = {
  customer: {
    id: "c1", name: "Ana Flores", phone: "5165550001", email: "ana@x.com",
    orderCount: 2, firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-06-30T10:00:00Z",
    notes: "Prefiere tulipanes",
    lastAddress: { street1: "1 Main St", city: "Albertson", state: "NY", zip: "11507", country: "US" },
  },
  metrics: {
    ltvCents: 12000, orderCount: 2, paidOrderCount: 2, aovCents: 6000,
    firstOrderAt: "2026-05-01T10:00:00Z", lastOrderAt: "2026-06-30T10:00:00Z",
    daysSinceLastOrder: 4, segment: "recurring", isVip: false, isAtRisk: false, isRecurring: true,
    isLapsed: false,
  },
  tags: ["boda"],
  dates: [],
  preferences: { favorite_flower: [], favorite_color: [], dislike: [] },
  orders: [order],
};

const emptyPrefs = { favorite_flower: [], favorite_color: [], dislike: [] };

describe("CustomerProfile", () => {
  it("renders header, metrics, notes, tags, and order history", () => {
    wrap(<CustomerProfile locale="es" initial={profile} suggestions={emptyPrefs} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByText("Recurrente")).toBeDefined();          // primary badge
    expect(screen.getByText("Ticket promedio")).toBeDefined();      // metrics row label
    expect(screen.getByText("$120.00")).toBeDefined();              // LTV
    expect(screen.getByDisplayValue("Prefiere tulipanes")).toBeDefined(); // notes textarea
    expect(screen.getByText("boda")).toBeDefined();                 // tag chip
    expect(screen.getByText("#1001")).toBeDefined();                // order row
    expect(screen.getByText("Historial de órdenes")).toBeDefined();
    expect(screen.getByText("Fechas importantes")).toBeDefined();
    expect(screen.getByText("Sin fechas guardadas.")).toBeDefined();
    expect(screen.getByText("Preferencias")).toBeDefined();
  });

  describe("renaming a customer", () => {
    // The CRM used to name a web buyer after the person they sent flowers to, so
    // the shop needs to be able to put the right name on the record. The API has
    // always accepted it; the profile screen never offered it.
    let fetchMock: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ customer: { ...profile.customer, name: "Robyn Vega" } }),
      });
      vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("saves a corrected name and shows it", async () => {
      const user = userEvent.setup();
      wrap(<CustomerProfile locale="es" initial={profile} suggestions={emptyPrefs} />);

      await user.click(screen.getByRole("button", { name: "Editar nombre" }));
      const input = screen.getByRole("textbox", { name: "Nombre" });
      expect(input).toHaveValue("Ana Flores");
      await user.clear(input);
      await user.type(input, "Robyn Vega");
      await user.click(screen.getByRole("button", { name: "Guardar nombre" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/admin/customers/c1");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body)).toEqual({ name: "Robyn Vega" });
      expect(await screen.findByText("Robyn Vega")).toBeDefined();
    });

    it("cancels without touching the record", async () => {
      const user = userEvent.setup();
      wrap(<CustomerProfile locale="es" initial={profile} suggestions={emptyPrefs} />);

      await user.click(screen.getByRole("button", { name: "Editar nombre" }));
      await user.clear(screen.getByRole("textbox", { name: "Nombre" }));
      await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Equivocado");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByText("Ana Flores")).toBeDefined();
    });

    it("refuses to save an empty name", async () => {
      const user = userEvent.setup();
      wrap(<CustomerProfile locale="es" initial={profile} suggestions={emptyPrefs} />);

      await user.click(screen.getByRole("button", { name: "Editar nombre" }));
      await user.clear(screen.getByRole("textbox", { name: "Nombre" }));
      await user.click(screen.getByRole("button", { name: "Guardar nombre" }));

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("quick action links to intake with the phone prefilled", () => {
    wrap(<CustomerProfile locale="es" initial={profile} suggestions={emptyPrefs} />);
    const link = screen.getByRole("link", { name: "Nueva orden para este cliente" });
    expect(link.getAttribute("href")).toBe("/es/admin/intake?phone=5165550001");
  });
});
