import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import DeliverSheet from "@/components/admin/dashboard/DeliverSheet";
import type { Order } from "@/types/order";

const order: Order = {
  id: "o1", orderNumber: 1234, source: "web", locale: "es", lines: [],
  fulfillment: {
    method: "delivery",
    recipient: { name: "Ana López", phone: "5551234567" },
    address: { street1: "12 Main St", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-10-12", slot: "midday" },
  },
  contact: { phone: "5551234567" },
  totals: { subtotalCents: 5000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 5000 },
  status: "out-for-delivery", paymentStatus: "paid",
  createdAt: "2026-10-12T00:00:00Z", updatedAt: "2026-10-12T00:00:00Z",
};

const prepare = vi.fn(async () => ({
  blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), width: 1600, height: 1200,
}));
let fetchMock: ReturnType<typeof vi.fn>;

function wrap(onDelivered = vi.fn()) {
  render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      <DeliverSheet order={order} onDelivered={onDelivered} onClose={() => {}} prepare={prepare} />
    </NextIntlClientProvider>,
  );
  return onDelivered;
}

function pickPhoto() {
  const input = screen.getByTestId("deliver-photo-input") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "p.heic", { type: "image/heic" })] } });
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  fetchMock = vi.fn(async (url: string) =>
    url.endsWith("/delivery-photo")
      ? new Response(JSON.stringify({ token: "t", url: "/api/delivery-photo/t" }))
      : new Response(JSON.stringify({ order: {} })));
  vi.stubGlobal("fetch", fetchMock);
  prepare.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("DeliverSheet", () => {
  it("delivers without photo: PATCH only", async () => {
    const done = wrap();
    fireEvent.click(screen.getByRole("button", { name: "Entregar sin foto" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/admin/orders/o1/fulfillment");
  });

  it("with photo: uploads, then PATCHes", async () => {
    const done = wrap();
    pickPhoto();
    await waitFor(() => screen.getByRole("button", { name: "Confirmar entrega" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/admin/orders/o1/delivery-photo",
      "/api/admin/orders/o1/fulfillment",
    ]);
  });

  it("upload failure does not deliver and offers retry / without photo", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 500 }));
    const done = wrap();
    pickPhoto();
    await waitFor(() => screen.getByRole("button", { name: "Confirmar entrega" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    await waitFor(() => screen.getByText("No se pudo subir la foto. Revisa la señal."));
    expect(done).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).endsWith("/fulfillment"))).toBe(true);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Entregar sin foto" })).toBeDefined();
  });

  it("PATCH failure after upload retries the PATCH without re-uploading", async () => {
    let patchCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/delivery-photo")) return new Response(JSON.stringify({ token: "t", url: "/api/delivery-photo/t" }));
      patchCalls++;
      return patchCalls === 1 ? new Response("{}", { status: 500 }) : new Response("{}");
    });
    const done = wrap();
    pickPhoto();
    await waitFor(() => screen.getByRole("button", { name: "Confirmar entrega" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega" }));
    await waitFor(() => screen.getByText("No se pudo marcar como entregado."));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    const uploads = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/delivery-photo"));
    expect(uploads).toHaveLength(1);
  });

  it("decode failure shows a message", async () => {
    prepare.mockRejectedValueOnce(new Error("decode"));
    wrap();
    pickPhoto();
    await waitFor(() => screen.getByText("No se pudo leer la foto."));
  });
});
