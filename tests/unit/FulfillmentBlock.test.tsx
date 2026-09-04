import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
