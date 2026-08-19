import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ORCHID_CARE } from "@/data/orchid-care";

declare global {
  // eslint-disable-next-line no-var
  var __ORCHIDS_CARE_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const enMessages = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const esMessages = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const locale = globalThis.__ORCHIDS_CARE_LOCALE__ ?? "en";
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

const { OrchidsCare } = await import("@/components/orchids/OrchidsCare");

async function renderCare(locale: "en" | "es" = "en") {
  globalThis.__ORCHIDS_CARE_LOCALE__ = locale;
  const ui = await OrchidsCare({ locale });
  return render(ui);
}

describe("OrchidsCare", () => {
  afterEach(() => {
    delete (globalThis as any).__ORCHIDS_CARE_LOCALE__;
  });

  it("renders every care step", async () => {
    await renderCare("en");
    for (const step of ORCHID_CARE) {
      expect(screen.getByText(step.title.en)).toBeInTheDocument();
    }
  });

  it("renders the Spanish copy under the es locale", async () => {
    await renderCare("es");
    for (const step of ORCHID_CARE) {
      expect(screen.getByText(step.title.es)).toBeInTheDocument();
    }
  });

  it("numbers the steps in order", async () => {
    await renderCare("en");
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
  });
});
