import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import CardDatesPanel from "@/components/admin/occasions/CardDatesPanel";
import type { CardReview, CardScanPreview } from "@/lib/card-dates-scan";

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

const preview: CardScanPreview = { pendingOrders: 5, wouldSave: 3, wouldReview: 2, unlinkedOrders: 0 };
const review = (over: Partial<CardReview> = {}): CardReview => ({
  orderId: "o1", customerId: "c1", customerName: "Ana Flores", recipientName: "Rosa Pérez",
  cardMessage: "Feliz cumpleaños mamá, de Zebulón", month: 3, day: 21, relationship: "madre",
  needsName: false, ...over,
});

const json = (b: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(b), { status }));

describe("CardDatesPanel", () => {
  it("shows the pending summary", () => {
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[]} />);
    expect(
      screen.getByText("5 pedidos con tarjeta sin leer: se guardarían 3 fechas y 2 quedarían por revisar."),
    ).toBeDefined();
    expect((screen.getByRole("button", { name: "Buscar fechas en tarjetas" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("warns about unlinked orders", () => {
    wrap(<CardDatesPanel initialPreview={{ ...preview, unlinkedOrders: 4 }} initialReviews={[]} />);
    expect(
      screen.getByText("4 pedidos con tarjeta todavía no tienen cliente. Corre primero «Ligar pedidos» en Clientes."),
    ).toBeDefined();
  });

  it("disables the button and says nothing is left when nothing is pending", () => {
    wrap(<CardDatesPanel initialPreview={{ ...preview, pendingOrders: 0 }} initialReviews={[]} />);
    expect((screen.getByRole("button", { name: "Buscar fechas en tarjetas" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("No hay tarjetas por leer.")).toBeDefined();
  });

  it("runs the scan and shows the result, including failures", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      json({
        report: { scanned: 5, saved: 3, review: 2, duplicate: 0, excluded: 0, none: 0, failed: 1 },
        preview: { ...preview, pendingOrders: 0 },
        reviews: [review()],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[]} />);
    await user.click(screen.getByRole("button", { name: "Buscar fechas en tarjetas" }));
    await waitFor(() => expect(screen.getByText("Listo: 3 fechas guardadas y 2 por revisar.")).toBeDefined());
    expect(screen.getByText("1 pedidos no se pudieron leer; se volverán a intentar.")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/occasions/card-dates", expect.objectContaining({ method: "POST" }));
    expect(screen.getByText("Por revisar (1)")).toBeDefined();
  });

  it("shows the card message and dismiss removes the row", async () => {
    const fetchMock = vi.fn().mockImplementation(() => json({ result: "dismissed", reviews: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[review()]} />);
    expect(screen.getByText(/Feliz cumpleaños mamá, de Zebulón/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByText(/Feliz cumpleaños mamá/)).toBeNull());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/occasions/card-dates/review");
    expect(JSON.parse(init.body)).toEqual({ orderId: "o1", action: "dismiss" });
  });

  it("needs a name before birthday/anniversary when the card does not say who", async () => {
    const fetchMock = vi.fn().mockImplementation(() => json({ result: "saved", reviews: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[review({ needsName: true })]} />);
    const bday = screen.getByRole("button", { name: "Cumpleaños" }) as HTMLButtonElement;
    const anniv = screen.getByRole("button", { name: "Aniversario" }) as HTMLButtonElement;
    expect(bday.disabled).toBe(true);
    expect(anniv.disabled).toBe(true);
    await user.type(screen.getByPlaceholderText("¿Para quién es?"), "Luz");
    expect(bday.disabled).toBe(false);
    await user.click(bday);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ orderId: "o1", action: "birthday", name: "Luz" });
  });

  it("shows who the card is for and the order number", () => {
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[review({ orderNumber: 1234 })]} />);
    expect(screen.getByText(/Ana Flores · Rosa Pérez · #1234 ·/)).toBeDefined();
  });

  it("drops a row that was already resolved elsewhere (404) and says so", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => json({ result: "not_found" }, 404)));
    const user = userEvent.setup();
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[review()]} />);
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByText(/Feliz cumpleaños mamá/)).toBeNull());
    expect(screen.getByText("Esta tarjeta ya se resolvió en otro lado.")).toBeDefined();
  });

  it("keeps the row and shows the name hint on name_required (400)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => json({ result: "name_required" }, 400)));
    const user = userEvent.setup();
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[review({ needsName: true })]} />);
    await user.type(screen.getByPlaceholderText("¿Para quién es?"), "x");
    await user.click(screen.getByRole("button", { name: "Cumpleaños" }));
    await waitFor(() => expect(screen.getByText("Escribe para quién es.")).toBeDefined());
    expect(screen.getByText(/Feliz cumpleaños mamá/)).toBeDefined();
  });

  it("drops the resolved row locally when the server could not re-list (reviews: null)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => json({ result: "dismissed", reviews: null })));
    const user = userEvent.setup();
    wrap(<CardDatesPanel initialPreview={preview} initialReviews={[review(), review({ orderId: "o2", cardMessage: "Otra tarjeta" })]} />);
    await user.click(screen.getAllByRole("button", { name: "Descartar" })[0]);
    await waitFor(() => expect(screen.queryByText(/Feliz cumpleaños mamá/)).toBeNull());
    expect(screen.getByText(/Otra tarjeta/)).toBeDefined();
  });
});
