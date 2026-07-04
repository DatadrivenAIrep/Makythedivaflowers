import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import InquiryDrawer from "@/components/admin/pipeline/InquiryDrawer";
import type { InquiryDetail } from "@/lib/inquiry-storage-db";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const detail: InquiryDetail = {
  inquiry: {
    id: "iq1", type: "wedding", stage: "contactado", contactName: "Ana Flores",
    contactEmail: "ana@x.com", contactPhone: "5165551234", budgetBand: "10-25k",
    eventDate: "2027-06-01", venue: "Glen Cove", guests: 120, vibe: "garden",
    notes: "llamar el viernes", sourceChannel: "web",
    createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
  },
  changes: [{ id: "c1", inquiryId: "iq1", at: "2026-07-01T00:00:00Z", actor: "maky", kind: "created", summary: "Lead creado · web" }],
};

describe("InquiryDrawer", () => {
  it("renders contact, stage selector, notes, history, and mark-lost", () => {
    wrap(<InquiryDrawer detail={detail} locale="es" onClose={() => {}} onChanged={() => {}} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByDisplayValue("llamar el viernes")).toBeDefined();
    expect(screen.getByText("Glen Cove")).toBeDefined();
    expect(screen.getByText("Marcar perdido")).toBeDefined();
    expect(screen.getByText("Lead creado · web")).toBeDefined();
    const select = screen.getByLabelText("Etapa") as HTMLSelectElement;
    expect(select.value).toBe("contactado");
  });
});
