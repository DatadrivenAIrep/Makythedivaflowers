import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// next-intl's server `getTranslations` requires RSC context that jsdom doesn't
// provide. Stub it with a synchronous lookup against our messages so the async
// server component renders. The active locale is set per-render via a
// `globalThis` flag (the only safe channel between this test module and the
// hoisted `vi.mock` factory).
declare global {
  // eslint-disable-next-line no-var
  var __PROM_PIECES_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const enMessages = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const esMessages = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const locale = globalThis.__PROM_PIECES_LOCALE__ ?? "en";
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

const { PromPieces } = await import("@/components/prom/PromPieces");

async function renderPieces(locale: "en" | "es" = "en") {
  globalThis.__PROM_PIECES_LOCALE__ = locale;
  const ui = await PromPieces({ locale });
  return render(ui);
}

describe("PromPieces", () => {
  afterEach(() => {
    delete (globalThis as any).__PROM_PIECES_LOCALE__;
  });

  it("renders all four pieces with prices in EN", async () => {
    await renderPieces("en");
    expect(screen.getByText("Rose corsage")).toBeDefined();
    expect(screen.getByText("Orchid boutonnière")).toBeDefined();
    expect(screen.getByText(/\$45/)).toBeDefined();
  });

  it("renders all four pieces with prices in ES", async () => {
    await renderPieces("es");
    expect(screen.getByText("Corsage de orquídea")).toBeDefined();
    expect(screen.getByText(/\$25/)).toBeDefined();
  });

  it("anchors each card to its id for deep links from the home tile", async () => {
    const { container } = await renderPieces("en");
    expect(container.querySelector("#rose-corsage")).not.toBeNull();
    expect(container.querySelector("#rose-boutonniere")).not.toBeNull();
    expect(container.querySelector("#orchid-corsage")).not.toBeNull();
    expect(container.querySelector("#orchid-boutonniere")).not.toBeNull();
  });
});
