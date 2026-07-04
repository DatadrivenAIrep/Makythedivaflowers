// tests/unit/wedding-stories-cta.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var __WSTORIES_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl", async () => {
  const en = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const es = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    useTranslations: (namespace: string) => (key: string) => {
      const locale = globalThis.__WSTORIES_LOCALE__ ?? "en";
      const dict = locale === "es" ? es : en;
      return `${namespace}.${key}`
        .split(".")
        .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], dict) as string;
    },
  };
});

const { WeddingStories } = await import("@/components/weddings/WeddingStories");

describe("WeddingStories CTA", () => {
  afterEach(() => {
    delete (globalThis as any).__WSTORIES_LOCALE__;
  });

  it("renders a CTA link to #inquire", () => {
    globalThis.__WSTORIES_LOCALE__ = "en";
    render(<WeddingStories locale="en" />);
    const cta = screen.getByRole("link", { name: /Start planning/i });
    expect(cta).toHaveAttribute("href", "#inquire");
  });
});
