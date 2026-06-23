import { describe, it, expect } from "vitest";
import type { GiftCard } from "@/types/gift-card";
import {
  __buildGiftCardHtml as buildHtml,
  __buildGiftCardBody as buildBody,
} from "@/lib/gift-card-notifications";

const card: GiftCard = {
  id: "gc_1",
  code: "DIVA-7K2M-9XQ4",
  initialCents: 15000,
  balanceCents: 15000,
  status: "active",
  recipientEmail: "maria@example.com",
  recipientName: "María",
  fromLabel: "Maky · Diva Flowers",
  personalMessage: "¡Gracias por ser parte de la familia Diva!",
  reason: "loyalty",
  issuedBy: "maky",
  expiresAt: "2027-06-22T00:00:00.000Z",
  createdAt: "2026-06-22T00:00:00.000Z",
  updatedAt: "2026-06-22T00:00:00.000Z",
};

describe("gift card email body", () => {
  it("includes the recipient, amount, code and expiry", () => {
    const body = buildBody(card, "es");
    expect(body).toContain("María");
    expect(body).toContain("$150.00");
    expect(body).toContain("DIVA-7K2M-9XQ4");
    expect(body).toContain("2027");
  });

  it("renders the personal message and the from label", () => {
    const body = buildBody(card, "es");
    expect(body).toContain("¡Gracias por ser parte de la familia Diva!");
    expect(body).toContain("Maky · Diva Flowers");
  });
});

describe("gift card email html", () => {
  it("escapes the personal message and embeds the code", () => {
    const html = buildHtml({ ...card, personalMessage: "<b>hi</b>" }, "es");
    expect(html).toContain("DIVA-7K2M-9XQ4");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).not.toContain("<b>hi</b>");
  });
});
