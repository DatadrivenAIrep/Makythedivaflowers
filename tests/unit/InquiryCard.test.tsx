import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import InquiryCard from "@/components/admin/pipeline/InquiryCard";
import type { Inquiry } from "@/lib/inquiry-storage-db";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const inquiry: Inquiry = {
  id: "iq1", type: "wedding", stage: "nuevo", contactName: "Ana Flores",
  contactEmail: "ana@x.com", contactPhone: "5165551234", budgetBand: "10-25k",
  eventDate: "2027-06-01", sourceChannel: "web",
  createdAt: "2026-07-01T00:00:00Z", updatedAt: "2026-07-01T00:00:00Z",
};

describe("InquiryCard", () => {
  it("renders name, type, budget, and a new dot when unacknowledged", () => {
    const { container } = wrap(<InquiryCard inquiry={inquiry} locale="es" onOpen={() => {}} />);
    expect(screen.getByText("Ana Flores")).toBeDefined();
    expect(screen.getByText("Boda")).toBeDefined();
    expect(screen.getByText("$10–25k")).toBeDefined();
    expect(container.querySelector('[data-testid="unseen-dot"]')).not.toBeNull();
  });

  it("hides the dot once acknowledged", () => {
    const { container } = wrap(
      <InquiryCard inquiry={{ ...inquiry, acknowledgedAt: "2026-07-02T00:00:00Z" }} locale="es" onOpen={() => {}} />,
    );
    expect(container.querySelector('[data-testid="unseen-dot"]')).toBeNull();
  });
});
