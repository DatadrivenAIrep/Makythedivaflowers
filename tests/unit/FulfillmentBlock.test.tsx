import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import FulfillmentBlock, { type FulfillmentState } from "@/components/admin/intake/FulfillmentBlock";

function baseValue(overrides: Partial<FulfillmentState["window"]> = {}): FulfillmentState {
  return {
    method: "pickup", // shows the window controls without the delivery address block
    recipient: { name: "Lola", phone: "5165550100" },
    address: { street1: "", city: "", state: "NY", zip: "", country: "US" },
    window: { date: "2099-01-01", slot: "midday", ...overrides },
    cardMessage: "",
  };
}

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FulfillmentBlock delivery time", () => {
  it("renders the exact-time input and a chip per slot", () => {
    wrap(<FulfillmentBlock value={baseValue()} onChange={() => {}} />);
    expect(screen.getByLabelText("Hora exacta (opcional)")).toBeDefined();
    for (const label of ["Mañana", "Mediodía", "Tarde", "Noche"]) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("typing an exact time stores it and derives the slot", () => {
    const onChange = vi.fn();
    wrap(<FulfillmentBlock value={baseValue({ slot: "midday" })} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Hora exacta (opcional)"), { target: { value: "15:30" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FulfillmentState;
    expect(next.window.time).toBe("15:30");
    expect(next.window.slot).toBe("afternoon"); // 15:30 buckets into afternoon
  });

  it("picking a slot chip clears any exact time (goes flexible)", () => {
    const onChange = vi.fn();
    wrap(<FulfillmentBlock value={baseValue({ slot: "afternoon", time: "15:30" })} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Mañana" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FulfillmentState;
    expect(next.window.slot).toBe("morning");
    expect(next.window.time).toBeUndefined();
  });

  it("shows the derived-from-time label only when a time is set", () => {
    const { rerender } = wrap(<FulfillmentBlock value={baseValue()} onChange={() => {}} />);
    expect(screen.getByText("O elige una franja")).toBeDefined();
    rerender(
      <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
        <FulfillmentBlock value={baseValue({ time: "14:00" })} onChange={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Franja (según la hora)")).toBeDefined();
  });
});

describe("FulfillmentBlock funeral toggle", () => {
  it("checking 'Es para funeral' sets the flag", () => {
    const onChange = vi.fn();
    wrap(<FulfillmentBlock value={baseValue()} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: /Es para funeral/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect((onChange.mock.calls[0][0] as FulfillmentState).funeral).toBe(true);
  });

  it("reflects a funeral order as checked", () => {
    wrap(<FulfillmentBlock value={{ ...baseValue(), funeral: true }} onChange={() => {}} />);
    expect((screen.getByRole("checkbox", { name: /Es para funeral/ }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("FulfillmentBlock recipient lookup", () => {
  const lastAddress = { street1: "9 Tulip Ct", city: "Bayville", state: "NY", zip: "11709", country: "US" as const };
  const known = {
    name: "Carmen", phone: "5165559999", orderCount: 2, lastDate: "2026-06-01", lastAddress,
    senders: [{ name: "Luis", phone: "5165550200", orderCount: 2 }],
  };

  // The address autocomplete fetches too, so answer per call and only for the lookup.
  function mockRecipientLookup() {
    return vi.spyOn(global, "fetch").mockImplementation(async (input) =>
      String(input).includes("/api/admin/recipients/lookup")
        ? new Response(JSON.stringify({ found: true, recipient: known }), { status: 200 })
        : new Response("{}", { status: 404 }),
    );
  }

  function delivery(recipient: { name: string; phone: string }): FulfillmentState {
    return { ...baseValue(), method: "delivery", recipient };
  }

  it("fills an empty name and street from a known recipient phone", async () => {
    const fetchSpy = mockRecipientLookup();
    const onChange = vi.fn();
    wrap(<FulfillmentBlock value={delivery({ name: "", phone: "(516) 555-9999" })} onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const next = onChange.mock.calls[0][0] as FulfillmentState;
    expect(next.recipient.name).toBe("Carmen");
    expect(next.address).toEqual(lastAddress);
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("lookup?phone=5165559999"))).toBe(true);
    expect(await screen.findByText("Ya recibió 2 veces · la última de Luis")).toBeDefined();
    fetchSpy.mockRestore();
  });

  it("never overwrites a name staff already typed", async () => {
    const fetchSpy = mockRecipientLookup();
    const onChange = vi.fn();
    const value = { ...delivery({ name: "Carmencita", phone: "5165559999" }), address: { ...lastAddress, street1: "1 Other St" } };
    wrap(<FulfillmentBlock value={value} onChange={onChange} />);
    await screen.findByText("usar su última dirección");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("usar su última dirección"));
    expect((onChange.mock.calls[0][0] as FulfillmentState).address).toEqual(lastAddress);
    fetchSpy.mockRestore();
  });
});

describe("FulfillmentBlock card message", () => {
  it("counts characters against the 500 limit and warns when long", () => {
    const long = "a".repeat(300);
    wrap(<FulfillmentBlock value={{ ...baseValue(), cardMessage: long }} onChange={() => {}} />);
    expect(screen.getByText("300/500")).toBeDefined();
    expect(screen.getByText(/Mensaje largo/)).toBeDefined();
    expect(screen.getByPlaceholderText("Para mi mamá, con todo mi cariño...").getAttribute("maxLength")).toBe("500");
  });
});
