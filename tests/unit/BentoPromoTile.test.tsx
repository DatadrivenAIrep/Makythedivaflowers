import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var __BENTO_PROMO_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const en = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const es = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => (key: string) => {
      const locale = globalThis.__BENTO_PROMO_LOCALE__ ?? "en";
      const dict = locale === "es" ? es : en;
      return `${namespace}.${key}`
        .split(".")
        .reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], dict) as string;
    },
  };
});

const { BentoPromoTile } = await import("@/components/home/BentoPromoTile");

async function renderTile(
  props: { namespace: string; imageSrc: string; href: string },
  locale: "en" | "es" = "en",
) {
  globalThis.__BENTO_PROMO_LOCALE__ = locale;
  return render(await BentoPromoTile({ locale, ...props }));
}

describe("BentoPromoTile", () => {
  afterEach(() => {
    delete (globalThis as any).__BENTO_PROMO_LOCALE__;
  });

  it("renders the weddings tile with title + CTA linking to /weddings", async () => {
    await renderTile({
      namespace: "home.bento.weddings",
      imageSrc: "/images/wedding-stories-header.webp",
      href: "/en/weddings",
    });
    expect(screen.getByText("Weddings")).toBeInTheDocument();
    expect(screen.getByText("Installations they'll remember.")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/en/weddings");
  });

  it("renders the events tile in Spanish with CTA linking to /events", async () => {
    await renderTile(
      {
        namespace: "home.bento.events",
        imageSrc: "/events/evento-01/p01.webp",
        href: "/es/events",
      },
      "es",
    );
    expect(screen.getByText("Eventos")).toBeInTheDocument();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/es/events");
  });
});
