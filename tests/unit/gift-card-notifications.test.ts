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

describe("gift card email styling", () => {
  // A double quote inside style="..." ends the attribute early, so every
  // declaration after the font stack is silently dropped by the mail client.
  it("never puts a double quote inside a style attribute", () => {
    const html = buildHtml(card, "en");
    for (const m of html.matchAll(/style="([^"]*)"/g)) {
      const after = html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 1);
      expect(after, `style attribute cut short: ${m[1]}`).toMatch(/[\s>/]/);
    }
  });
});

describe("gift card email headline", () => {
  it("uses the custom headline instead of the default greeting", () => {
    const html = buildHtml({ ...card, headline: "A gift for The Shelter Connection" }, "en");
    expect(html).toContain("A gift for The Shelter Connection");
    expect(html).not.toContain("someone sent you flowers");
  });

  it("escapes the custom headline", () => {
    const html = buildHtml({ ...card, headline: "<i>x</i>" }, "en");
    expect(html).toContain("&lt;i&gt;x&lt;/i&gt;");
  });

  it("escapes the recipient name exactly once", () => {
    const html = buildHtml({ ...card, recipientName: "O'Brien" }, "en");
    expect(html).toContain("O&#39;Brien, someone sent you flowers");
    expect(html).not.toContain("&amp;#39;");
  });

  it("falls back to the default greeting without one", () => {
    expect(buildHtml(card, "en")).toContain("María, someone sent you flowers");
  });

  it("leads the plain-text body with the custom headline", () => {
    const body = buildBody({ ...card, headline: "A gift for The Shelter Connection" }, "en");
    expect(body.split("\n")[0]).toBe("A gift for The Shelter Connection");
  });
});

describe("gift card email co-brand partner", () => {
  it("shows the partner logo and name when the card has one", () => {
    const html = buildHtml({ ...card, partner: "the-shelter-connection" }, "en");
    expect(html).toContain("/partners/the-shelter-connection.png");
    expect(html).toContain('alt="The Shelter Connection"');
    expect(html).toContain("In partnership with");
  });

  it("renders no partner block without one", () => {
    expect(buildHtml(card, "en")).not.toContain("/partners/");
  });

  it("names the partner in the plain-text body", () => {
    const body = buildBody({ ...card, partner: "the-shelter-connection" }, "en");
    expect(body).toContain("In partnership with The Shelter Connection");
  });
});
