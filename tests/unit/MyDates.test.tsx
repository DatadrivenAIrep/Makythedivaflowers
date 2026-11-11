import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("con STOP muestra START y no hay casilla", () => {
    renderIt(view({ permission: "stopped" }));
    expect(screen.getByText(es.date_prompt.stopped_note)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
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
