import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import PipelineBoard from "@/components/admin/pipeline/PipelineBoard";
import type { Inquiry } from "@/lib/inquiry-storage-db";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function inq(id: string, stage: string): Inquiry {
  return {
    id, type: "wedding", stage: stage as Inquiry["stage"], contactName: `Lead ${id}`,
    contactEmail: `${id}@x.com`, contactPhone: "5551", budgetBand: "10-25k", sourceChannel: "web",
    createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
  };
}

const initial = {
  inquiries: [inq("a", "nuevo"), inq("b", "reservado")],
  stats: { counts: { nuevo: 1, contactado: 0, propuesta: 0, reservado: 1, completado: 0, perdido: 0 }, openValueCents: 2000000 },
};

describe("PipelineBoard", () => {
  it("renders the 5 stage columns, cards, and the open value", () => {
    wrap(<PipelineBoard locale="es" initial={initial} />);
    expect(screen.getByText("Nuevo")).toBeDefined();
    expect(screen.getByText("Contactado")).toBeDefined();
    expect(screen.getByText("Reservado")).toBeDefined();
    expect(screen.getByText("Lead a")).toBeDefined();
    expect(screen.getByText("Lead b")).toBeDefined();
    expect(screen.getByText("Nuevo lead")).toBeDefined(); // add button
    expect(screen.getByText("$20,000.00")).toBeDefined(); // open value
  });
});
