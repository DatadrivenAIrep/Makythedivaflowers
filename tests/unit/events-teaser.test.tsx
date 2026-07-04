// tests/unit/events-teaser.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var __EVENTS_TEASER_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const en = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const es = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => (key: string) => {
      const locale = globalThis.__EVENTS_TEASER_LOCALE__ ?? "en";
      const dict = locale === "es" ? es : en;
      return `${namespace}.${key}`
        .split(".")
        .reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], dict) as string;
    },
  };
});

const { EventsTeaser } = await import("@/components/home/EventsTeaser");

describe("EventsTeaser", () => {
  afterEach(() => {
    delete (globalThis as any).__EVENTS_TEASER_LOCALE__;
  });

  it("renders the EN title and a link to /en/events", async () => {
    globalThis.__EVENTS_TEASER_LOCALE__ = "en";
    render(await EventsTeaser({ locale: "en" }));
    expect(screen.getByText("Florals for every occasion.")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Plan an event/i });
    expect(link).toHaveAttribute("href", "/en/events");
  });
});
