import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import GiftCardsView from "@/components/admin/gift-cards/GiftCardsView";
import type { GiftCardListItem, GiftCardStats } from "@/lib/gift-card-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const cards: GiftCardListItem[] = [
  {
    id: "gc_1", code: "DIVA-7K2M-9XQ4", initialCents: 15000, balanceCents: 6000,
    status: "active", recipientEmail: "jose@example.com", recipientName: "José",
    reason: "apology", expiresAt: "2027-05-10T00:00:00Z",
    createdAt: "2026-05-10T00:00:00Z", updatedAt: "2026-05-10T00:00:00Z",
    display: "partial",
  },
];
const stats: GiftCardStats = { activeCount: 1, pendingCents: 6000, issuedCents: 15000, redeemedCents: 9000 };

describe("GiftCardsView", () => {
  it("renders the stats and a row with its code, balance and status", () => {
    wrap(<GiftCardsView initialCards={cards} initialStats={stats} locale="es" />);
    expect(screen.getByText("DIVA-7K2M-9XQ4")).toBeDefined();
    expect(screen.getByText("José")).toBeDefined();
    expect(screen.getByText("$60.00 / $150.00")).toBeDefined();
    expect(screen.getByText("Usada parcial")).toBeDefined();
  });
});
