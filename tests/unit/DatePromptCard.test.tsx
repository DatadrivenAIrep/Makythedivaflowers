import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "@/messages/es.json";
import { DatePromptCard } from "@/components/checkout/DatePromptCard";

type Prompt = {
  question: unknown;
  reward: unknown;
  permission: "granted" | "stopped" | "none";
};

const DATE_Q = { kind: "date", recipientName: "Laura", prefill: { month: 3, day: 18 } };
const LIKES_Q = { kind: "likes", dateId: "d1", recipientName: "Laura", prefill: null };

function prompt(over: Partial<Prompt> = {}): Prompt {
  return { question: DATE_Q, reward: { kind: "reward", reward: "15%" }, permission: "none", ...over };
}

function mockFetch(get: { status: number; body?: unknown }, ...posts: Array<{ status: number; body?: unknown }>) {
  const fn = vi.fn();
  for (const r of [get, ...posts]) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(r.body ?? {}), { status: r.status }));
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

function renderCard() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <DatePromptCard orderId="o1" locale="es" />
    </NextIntlClientProvider>,
  );
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("DatePromptCard", () => {
  it("no muestra nada con 404", async () => {
    const fetchMock = mockFetch({ status: 404 });
    const { container } = renderCard();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/orders/o1/date-prompt", expect.anything()));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });

  it("no muestra nada si el pedido falla de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const { container } = renderCard();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });

  it("muestra la pregunta con el nombre y la fecha precargada", async () => {
    mockFetch({ status: 200, body: prompt() });
    renderCard();
    await screen.findByText("¿Quieres que te recordemos una fecha importante de Laura?");
    expect((screen.getByLabelText("Mes") as HTMLSelectElement).value).toBe("3");
    expect((screen.getByLabelText("Día") as HTMLSelectElement).value).toBe("18");
  });

  it("muestra la promesa correcta según el premio", async () => {
    mockFetch({ status: 200, body: prompt() });
    const first = renderCard();
    await screen.findByText("Guarda esta fecha y llévate 15% en tu próxima compra");
    first.unmount();

    mockFetch({ status: 200, body: prompt({ reward: { kind: "stamp" } }) });
    const second = renderCard();
    await screen.findByText("Gana 1 sello");
    second.unmount();

    mockFetch({ status: 200, body: prompt({ reward: null }) });
    renderCard();
    await screen.findByText("Te avisamos antes para que no se te pase.");
  });

  it("usa el texto de premio de gustos en la pregunta de gustos", async () => {
    mockFetch({ status: 200, body: prompt({ question: LIKES_Q }) });
    renderCard();
    const favorites = await screen.findByRole("group", { name: "Flores favoritas" });
    expect(screen.getByText("¿Qué le gusta?")).toBeTruthy();
    expect(screen.queryByText(/llévate/)).toBeNull();
    fireEvent.click(within(favorites).getByRole("button", { name: "Rosas" }));
    expect(screen.getByText("Guárdalo y llévate 15% en tu próxima compra")).toBeTruthy();
  });

  it("gustos: Guardar sigue apagado con el selector vacío", async () => {
    mockFetch({ status: 200, body: prompt({ question: LIKES_Q }) });
    renderCard();
    const save = (await screen.findByRole("button", { name: "Guardar" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.queryByText("Te avisamos antes para que no se te pase.")).toBeNull();
  });

  it("gustos: solo 'evitar' no promete premio pero deja guardar", async () => {
    const fetchMock = mockFetch(
      { status: 200, body: prompt({ question: LIKES_Q }) },
      { status: 200, body: { ok: true, permission: "none", stamp: false } },
    );
    renderCard();
    const avoid = await screen.findByRole("group", { name: "Mejor evitar" });
    fireEvent.click(within(avoid).getByRole("button", { name: "Mucho polen" }));
    expect(screen.queryByText(/llévate/)).toBeNull();
    expect(screen.queryByText("Gana 1 sello")).toBeNull();
    expect(screen.queryByText("Te avisamos antes para que no se te pase.")).toBeNull();
    const save = screen.getByRole("button", { name: "Guardar" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await screen.findByText("Listo. Lo tendremos en cuenta.");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).avoid).toEqual(["heavy_pollen"]);
  });

  it("la casilla empieza sin marcar y no aparece con permiso", async () => {
    mockFetch({ status: 200, body: prompt() });
    const first = renderCard();
    const box = (await screen.findByRole("checkbox")) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText(/El consentimiento no es condición de compra/)).toBeTruthy();
    first.unmount();

    mockFetch({ status: 200, body: prompt({ permission: "granted" }) });
    renderCard();
    await screen.findByText("Guardar");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("Para recibir avisos, envía START a nuestro número.")).toBeNull();
  });

  it("con STOP muestra la instrucción de START", async () => {
    mockFetch({ status: 200, body: prompt({ permission: "stopped" }) });
    renderCard();
    await screen.findByText("Para recibir avisos, envía START a nuestro número.");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("Guardar envía smsOptIn false por defecto", async () => {
    const fetchMock = mockFetch(
      { status: 200, body: prompt() },
      { status: 200, body: { ok: true, permission: "none", stamp: true } },
    );
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));
    await screen.findByText("Listo. Guardamos la fecha, pero sin permiso de SMS no te avisaremos.");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/orders/o1/date-prompt");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ action: "date", kind: "birthday", month: 3, day: 18, smsOptIn: false });
    expect(screen.getByText("Tu sello va en camino a tu tarjeta.")).toBeTruthy();
  });

  it("no promete sello si no había tarjeta", async () => {
    mockFetch(
      { status: 200, body: prompt({ reward: null }) },
      { status: 200, body: { ok: true, permission: "none", stamp: true } },
    );
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));
    await screen.findByText(/Listo\./);
    expect(screen.queryByText("Tu sello va en camino a tu tarjeta.")).toBeNull();
  });

  it("con la casilla marcada envía smsOptIn true y confirma el aviso", async () => {
    const fetchMock = mockFetch(
      { status: 200, body: prompt() },
      { status: 200, body: { ok: true, permission: "granted", stamp: false } },
    );
    renderCard();
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Listo. Te avisaremos antes de la fecha.");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).smsOptIn).toBe(true);
  });

  it("un error al guardar muestra el mensaje y mantiene la tarjeta", async () => {
    mockFetch({ status: 200, body: prompt() }, { status: 409, body: { error: "already_answered" } });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));
    await screen.findByText("No se pudo guardar. Intenta de nuevo.");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeTruthy();
  });

  it("No, gracias envía dismiss y oculta la tarjeta", async () => {
    const fetchMock = mockFetch(
      { status: 200, body: prompt() },
      { status: 200, body: { ok: true, permission: "none", stamp: false } },
    );
    const { container } = renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "No, gracias" }));
    await waitFor(() => expect(container.innerHTML).toBe(""));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: "dismiss" });
  });

  it("guarda los gustos elegidos", async () => {
    const fetchMock = mockFetch(
      { status: 200, body: prompt({ question: LIKES_Q, permission: "granted" }) },
      { status: 200, body: { ok: true, permission: "granted", stamp: true } },
    );
    renderCard();
    const favorites = await screen.findByRole("group", { name: "Flores favoritas" });
    fireEvent.click(within(favorites).getByRole("button", { name: "Rosas" }));
    fireEvent.click(screen.getByRole("button", { name: "Rojo" }));
    fireEvent.click(screen.getByRole("button", { name: "Mucho polen" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Listo. Lo tendremos en cuenta.");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      action: "likes", flowers: ["roses"], colors: ["red"], avoid: ["heavy_pollen"], smsOptIn: false,
    });
  });

  it("no deja elegir una cuarta flor", async () => {
    mockFetch({ status: 200, body: prompt({ question: LIKES_Q }) });
    renderCard();
    // Flower buttons appear in "favorites" and "avoid"; the first group is favorites.
    const group = await screen.findByRole("group", { name: "Flores favoritas" });
    const btn = (name: string) => Array.from(group.querySelectorAll("button")).find((b) => b.textContent === name)!;
    for (const n of ["Rosas", "Hortensias", "Peonías"]) fireEvent.click(btn(n));
    fireEvent.click(btn("Tulipanes"));
    expect(btn("Tulipanes").getAttribute("aria-pressed")).toBe("false");
    expect(btn("Rosas").getAttribute("aria-pressed")).toBe("true");
    // Deselecting frees a slot.
    fireEvent.click(btn("Rosas"));
    fireEvent.click(btn("Tulipanes"));
    expect(btn("Tulipanes").getAttribute("aria-pressed")).toBe("true");
  });
});
