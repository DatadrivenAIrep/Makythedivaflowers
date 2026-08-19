import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var __ORCHIDS_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const enMessages = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const esMessages = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const locale = globalThis.__ORCHIDS_LOCALE__ ?? "en";
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

const { OrchidsSizes } = await import("@/components/orchids/OrchidsSizes");

async function renderSizes(locale: "en" | "es" = "en") {
  globalThis.__ORCHIDS_LOCALE__ = locale;
  const ui = await OrchidsSizes({ locale });
  return render(ui);
}

describe("OrchidsSizes", () => {
  afterEach(() => {
    delete (globalThis as any).__ORCHIDS_LOCALE__;
  });

  it("shows both prices, formatted without cents", async () => {
    await renderSizes("en");
    expect(screen.getByText("$65")).toBeInTheDocument();
    expect(screen.getByText("$85")).toBeInTheDocument();
  });

  it("labels each size in the active locale", async () => {
    await renderSizes("es");
    expect(screen.getByText("Un tallo")).toBeInTheDocument();
    expect(screen.getByText("Dos tallos")).toBeInTheDocument();
  });

  it("links each size to the product page", async () => {
    await renderSizes("en");
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs.filter((h) => h === "/en/product/phalaenopsis-orchid")).toHaveLength(2);
  });

  it("shows one photo per size", async () => {
    const { container } = await renderSizes("en");
    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(srcs).toEqual([
      "/products/phalaenopsis-white-single.webp",
      "/products/phalaenopsis-pink-double.webp",
    ]);
  });
});
