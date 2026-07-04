import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import PreferenceChips from "@/components/admin/customers/PreferenceChips";
import type { PreferencesMap } from "@/lib/customer-dates-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const prefs: PreferencesMap = {
  favorite_flower: ["peonías"],
  favorite_color: [],
  dislike: ["lirios"],
};
const empty: PreferencesMap = { favorite_flower: [], favorite_color: [], dislike: [] };

describe("PreferenceChips", () => {
  it("renders the three groups with their chips", () => {
    wrap(<PreferenceChips customerId="c1" initial={prefs} suggestions={empty} />);
    expect(screen.getByText("Flores favoritas")).toBeDefined();
    expect(screen.getByText("Colores favoritos")).toBeDefined();
    expect(screen.getByText("No le gusta / alergias")).toBeDefined();
    expect(screen.getByText("peonías")).toBeDefined();
    expect(screen.getByText("lirios")).toBeDefined();
  });

  it("styles the dislike chip as a warning", () => {
    wrap(<PreferenceChips customerId="c1" initial={prefs} suggestions={empty} />);
    const chip = screen.getByText("lirios").closest("span");
    expect(chip?.className).toContain("rose");
  });
});
