import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";
import { MyDates, type MyDatesView } from "@/components/account/MyDates";

const EMPTY_PREFS = { flowers: [], colors: [], avoid: [] };
function view(over: Partial<MyDatesView> = {}): MyDatesView {
  return {
    dates: [
      { id: "d1", kind: "birthday", label: "Laura", month: 3, day: 18, prefs: { flowers: ["roses"], colors: ["pink"], avoid: [] } },
      { id: "d2", kind: "anniversary", label: "Rosa", month: 6, day: 1, prefs: EMPTY_PREFS },
    ],
    suggestions: [],
    permission: "none",
    ...over,
  };
}

function renderIt(v: MyDatesView) {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <MyDates locale="es" initial={v} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("MyDates", () => {
  it("muestra persona, ocasión, fecha y gustos; 'Agregar gustos' si no hay", () => {
    renderIt(view());
    expect(screen.getByText("Laura")).toBeTruthy();
    expect(screen.getByText(/rosas en tonos rosados/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar gustos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agregar gustos" })).toBeTruthy();
  });

  it("borra sin confirmar: la fecha desaparece y se llama DELETE", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderIt(view());
    fireEvent.click(screen.getByRole("button", { name: "Borrar la fecha de Laura" }));
    expect(screen.queryByText("Laura")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/account/dates/d1", expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("una fecha de tarjeta dice de dónde viene y usa el parentesco sin nombre", () => {
    const v = view({
      dates: [{ id: "d9", kind: "birthday", source: "card", relationship: "madre", month: 3, day: 18, prefs: EMPTY_PREFS }],
    });
    renderIt(v);
    expect(screen.getByText("Guardada de un pedido tuyo")).toBeTruthy();
    expect(screen.getByText("mamá")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Borrar la fecha de mamá" })).toBeTruthy();
  });

  it("una fecha de tarjeta sin nombre conserva su palabra de aniversario, nunca la neutra", () => {
    renderIt(
      view({
        dates: [
          { id: "d9", kind: "anniversary", source: "card", relationship: "esposa", month: 6, day: 1, prefs: EMPTY_PREFS },
          { id: "d8", kind: "birthday", source: "card", label: "Rosa", relationship: "madre", month: 3, day: 18, prefs: EMPTY_PREFS },
          { id: "d7", kind: "birthday", source: "card", month: 4, day: 2, prefs: EMPTY_PREFS },
        ],
      }),
    );
    const list = screen.getByRole("region", { name: "Fechas guardadas" });
    const items = within(list).getAllByRole("listitem");
    // No label: the relationship is the who-line and the kind keeps its own word.
    expect(within(items[0]).getByText("esposa")).toBeTruthy();
    expect(items[0].textContent).toContain("Aniversario");
    expect(items[0].textContent).toContain("Guardada de un pedido tuyo");
    expect(list.textContent).not.toContain("Fecha especial");
    // A label wins over the relationship.
    expect(within(items[1]).getByText("Rosa")).toBeTruthy();
    expect(within(items[1]).queryByText("mamá")).toBeNull();
    expect(items[1].textContent).toContain("Cumpleaños");
    // Neither label nor relationship: no who-line, the delete button names the kind.
    expect(items[2].textContent).toContain("Cumpleaños");
    expect(screen.getByRole("button", { name: "Borrar la fecha de esposa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Borrar la fecha de Rosa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Borrar la fecha de Cumpleaños" })).toBeTruthy();
  });

  it("con STOP muestra START y no hay casilla", () => {
    renderIt(view({ permission: "stopped" }));
    expect(
      screen.getByText("Para recibir avisos, envía START a nuestro número y luego activa los avisos en Mis fechas."),
    ).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("una fecha custom muestra su ocasión con una palabra neutra, nunca como cumpleaños", () => {
    renderIt(view({ dates: [{ id: "d9", kind: "custom", label: "Graduación", month: 5, day: 20, prefs: EMPTY_PREFS }] }));
    // The add form below has its own "Cumpleaños" button: look only at the saved list.
    const list = screen.getByRole("region", { name: "Fechas guardadas" });
    expect(within(list).getByText("Graduación")).toBeTruthy();
    expect(list.textContent).toContain("Fecha especial");
    expect(list.textContent).not.toContain("Cumpleaños");
    expect(screen.getByRole("button", { name: "Borrar la fecha de Graduación" })).toBeTruthy();
  });

  it("se dibuja con un código de gusto que ya no está en la lista", () => {
    const odd = { flowers: ["nope"], colors: ["nada"], avoid: ["tampoco"] } as unknown as MyDatesView["dates"][number]["prefs"];
    renderIt(view({ dates: [{ id: "d1", kind: "birthday", label: "Laura", month: 3, day: 18, prefs: odd }] }));
    expect(screen.getByText("Laura")).toBeTruthy();
    expect(screen.queryByText(/Le gustan/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Editar gustos" }));
    expect(screen.getByRole("button", { name: "Guardar gustos" })).toBeTruthy();
  });

  it("la casilla empieza sin marcar y lleva la letra pequeña", () => {
    renderIt(view());
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText(es.date_prompt.consent_fine)).toBeTruthy();
  });

  it("con permiso muestra 'Activos' y Quitar, y Quitar lo apaga", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ permission: "none" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderIt(view({ permission: "granted" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/sms-permission",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ grant: false }) }),
    );
  });

  it("no promete sellos", () => {
    const { container } = renderIt(view({ suggestions: [{ key: "k", recipientName: "Ana", month: 9, day: 10 }] }));
    expect(container.textContent).not.toMatch(/sello/i);
  });

  it("una sugerencia se guarda con su nombre y fecha", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 })) // add
      .mockResolvedValue(new Response(JSON.stringify(view({ suggestions: [] })), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderIt(view({ suggestions: [{ key: "k", recipientName: "Ana", month: 9, day: 10 }] }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/account/dates",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "add", kind: "birthday", name: "Ana", month: 9, day: 10 }),
        }),
      ),
    );
  });
});
