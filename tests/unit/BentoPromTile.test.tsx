import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

// next-intl's server `getTranslations` requires RSC context that jsdom doesn't
// provide. Stub it with a synchronous lookup against our messages so the async
// server component renders. The active locale is set per-render via a
// `globalThis` flag (the only safe channel between this test module and the
// hoisted `vi.mock` factory).
declare global {
  // eslint-disable-next-line no-var
  var __BENTO_PROM_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const enMessages = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const esMessages = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const locale = globalThis.__BENTO_PROM_LOCALE__ ?? "en";
        const dict = locale === "es" ? esMessages : enMessages;
        return `${namespace}.${key}`
          .split(".")
          .reduce<unknown>(
            (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
            dict,
          ) as string;
      };
    },
  };
});

const { BentoPromTile } = await import("@/components/home/BentoPromTile");

// BentoPromTile is async (server component); we await it inline.
async function renderTile(locale: "en" | "es" = "en") {
  globalThis.__BENTO_PROM_LOCALE__ = locale;
  const ui = await BentoPromTile({ locale });
  return render(
    <NextIntlClientProvider locale={locale} messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("BentoPromTile", () => {
  it("renders all four prom pieces with their prices", async () => {
    await renderTile("en");
    expect(screen.getByText("Rose corsage")).toBeDefined();
    expect(screen.getByText("Rose boutonnière")).toBeDefined();
    expect(screen.getByText("Orchid corsage")).toBeDefined();
    expect(screen.getByText("Orchid boutonnière")).toBeDefined();
    expect(screen.getByText("$35")).toBeDefined();
    expect(screen.getByText("$15")).toBeDefined();
    expect(screen.getByText("$45")).toBeDefined();
    expect(screen.getByText("$25")).toBeDefined();
  });

  it("links each cell to its anchor on /[locale]/prom", async () => {
    await renderTile("en");
    const roseCorsage = screen.getByRole("link", { name: /Rose corsage/i });
    expect(roseCorsage.getAttribute("href")).toBe("/en/prom#rose-corsage");
    const orchidBout = screen.getByRole("link", { name: /Orchid boutonnière/i });
    expect(orchidBout.getAttribute("href")).toBe("/en/prom#orchid-boutonniere");
  });

  it("renders the main CTA linking to /[locale]/prom", async () => {
    await renderTile("es");
    const cta = screen.getByRole("link", { name: /Reservar →|Reservar$/i });
    expect(cta.getAttribute("href")).toBe("/es/prom");
  });
});
