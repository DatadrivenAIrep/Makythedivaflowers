import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TikTokVideo } from "@/data/tiktoks";

// Override the data import so we can drive empty / non-empty states per test.
const mockTiktoks = vi.hoisted(
  () => ({ TIKTOKS: [] as TikTokVideo[] }),
);
vi.mock("@/data/tiktoks", () => mockTiktoks);

// Mock next-intl/server (jsdom has no RSC context — same pattern as prom tests)
vi.mock("next-intl/server", async () => {
  const en = (await import("@/messages/en.json")).default;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const parts = `${namespace}.${key}`.split(".");
        let cur: unknown = en;
        for (const p of parts) {
          if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
            cur = (cur as Record<string, unknown>)[p];
          } else {
            return parts.join(".");
          }
        }
        return typeof cur === "string" ? cur : parts.join(".");
      };
    },
  };
});

// next-intl's useTranslations is used downstream by TikTokLightbox
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Framer Motion stub — matches the project pattern used in TikTokCard.test.tsx
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

import { TikTokStrip } from "@/components/home/TikTokStrip";

afterEach(() => {
  mockTiktoks.TIKTOKS = [];
});

async function renderStrip(locale: "en" | "es" = "en") {
  const ui = await TikTokStrip({ locale });
  return render(<>{ui}</>);
}

describe("TikTokStrip", () => {
  it("renders nothing when TIKTOKS is empty", async () => {
    mockTiktoks.TIKTOKS = [];
    const { container } = await renderStrip("en");
    expect(container.firstChild).toBeNull();
  });

  it("renders the section header and 2 cards when TIKTOKS has 2 entries", async () => {
    mockTiktoks.TIKTOKS = [
      {
        slug: "a",
        videoId: "1",
        url: "https://www.tiktok.com/@makythediva/video/1",
        thumbnail: { src: "/tiktoks/a.webp", alt: { en: "A", es: "A" } },
      },
      {
        slug: "b",
        videoId: "2",
        url: "https://www.tiktok.com/@makythediva/video/2",
        thumbnail: { src: "/tiktoks/b.webp", alt: { en: "B", es: "B" } },
      },
    ];
    await renderStrip("en");
    expect(screen.getByText("Watch the bouquets come together")).toBeDefined();
    expect(screen.getByText(/Behind the studio · TikTok/)).toBeDefined();
    expect(screen.getByAltText("A")).toBeDefined();
    expect(screen.getByAltText("B")).toBeDefined();
  });

  it("header CTA links to the canonical TikTok profile in a new tab", async () => {
    mockTiktoks.TIKTOKS = [
      {
        slug: "a",
        videoId: "1",
        url: "https://www.tiktok.com/@makythediva/video/1",
        thumbnail: { src: "/tiktoks/a.webp", alt: { en: "A", es: "A" } },
      },
    ];
    await renderStrip("en");
    const link = screen.getByRole("link", { name: /@makythediva/ }) as HTMLAnchorElement;
    expect(link.href).toBe("https://www.tiktok.com/@makythediva");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(link.rel).toContain("noreferrer");
  });
});
