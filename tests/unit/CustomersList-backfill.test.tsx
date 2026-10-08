import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import CustomersList from "@/components/admin/customers/CustomersList";
import type { CustomerListResult } from "@/lib/customer-storage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const metrics = {
  ltvCents: 0, orderCount: 1, paidOrderCount: 0, aovCents: 0,
  firstOrderAt: "2026-01-01T00:00:00Z", lastOrderAt: "2026-01-01T00:00:00Z",
  daysSinceLastOrder: 200, segment: "lapsed" as const, isVip: false, isAtRisk: false,
  isRecurring: false, isLapsed: true,
};

const initial: CustomerListResult = {
  customers: [{
    id: "ana", name: "Ana Flores", phone: "5165550001", orderCount: 1,
    firstSeenAt: "2026-01-01T00:00:00Z", lastSeenAt: "2026-01-01T00:00:00Z", tags: [], metrics,
  }],
  stats: { total: 1, newThisMonth: 0, repeatRatePct: 0, atRiskCount: 0, lapsedCount: 1 },
  nextCursor: null,
};

const refreshed: CustomerListResult = {
  ...initial,
  customers: [{ ...initial.customers[0], metrics: { ...metrics, ltvCents: 36000 } }],
};

describe("CustomersList backfill banner", () => {
  it("is hidden when no order is pending", () => {
    wrap(
      <CustomersList
        locale="es" initial={initial} allTags={[]}
        backfill={{ pendingOrders: 0, newCustomers: 0, ordersToMerge: 0 }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Ligar pedidos" })).toBeNull();
  });

  it("confirms, links the orders, shows the result and reloads the list", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/customers/backfill" && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({
          ordersScanned: 12, customersCreated: 3, ordersMerged: 9, failures: [], remaining: 0,
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify(refreshed), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    wrap(
      <CustomersList
        locale="es" initial={initial} allTags={[]}
        backfill={{ pendingOrders: 12, newCustomers: 3, ordersToMerge: 9 }}
      />,
    );

    expect(screen.getByText(/Hay 12 pedidos antiguos sin ligar a un cliente/)).toBeDefined();
    expect(screen.getByText("$0.00")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Ligar pedidos" }));
    expect(
      screen.getByText("Se crearán 3 clientes y se ligarán 12 pedidos. No se envía ningún mensaje."),
    ).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled(); // nothing runs before the confirm

    await user.click(screen.getByRole("button", { name: "Sí, ligar" }));

    await waitFor(() => expect(screen.getByRole("status").textContent)
      .toContain("Listo: 12 pedidos ligados, 3 clientes nuevos."));
    await waitFor(() => expect(screen.getByText("$360.00")).toBeDefined());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/customers/backfill", { method: "POST" });
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("/api/admin/customers?"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Ligar pedidos" })).toBeNull();
  });

  it("cancel goes back without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    wrap(
      <CustomersList
        locale="es" initial={initial} allTags={[]}
        backfill={{ pendingOrders: 1, newCustomers: 1, ordersToMerge: 0 }}
      />,
    );
    expect(screen.getByText(/Hay 1 pedido antiguo sin ligar/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Ligar pedidos" }));
    expect(screen.getByText(/Se creará 1 cliente y se ligará 1 pedido\./)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Ligar pedidos" })).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the banner when the run fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ error: "run_failed" }), { status: 500 }))));
    const user = userEvent.setup();
    wrap(
      <CustomersList
        locale="es" initial={initial} allTags={[]}
        backfill={{ pendingOrders: 2, newCustomers: 1, ordersToMerge: 1 }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ligar pedidos" }));
    await user.click(screen.getByRole("button", { name: "Sí, ligar" }));
    await waitFor(() =>
      expect(screen.getByText("No se pudieron ligar los pedidos. Intenta de nuevo.")).toBeDefined());
    expect(screen.getByRole("button", { name: "Ligar pedidos" })).toBeDefined();
  });
});
