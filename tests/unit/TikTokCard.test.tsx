import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { TikTokVideo } from "@/data/tiktoks";
import { TikTokCard } from "@/components/home/TikTokCard";

// next-intl's useTranslations needs i18n context; mock it for the lightbox
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
// Framer Motion's AnimatePresence leaves stale DOM refs in JSDOM teardown — stub it.
// This matches the existing project pattern (reviews.test.tsx, MobileDrawer.test.tsx).
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

const VIDEO: TikTokVideo = {
  slug: "test-bouquet",
  videoId: "7300000000000000000",
  url: "https://www.tiktok.com/@makythediva/video/7300000000000000000",
  thumbnail: {
    src: "/tiktoks/test-bouquet.webp",
    alt: { en: "Test bouquet thumbnail", es: "Miniatura de ramo de prueba" },
  },
  views: "128K",
};

afterEach(() => {
  // Radix portals to document.body — unmount React first (so portal teardown runs
  // through React), then wipe any stragglers.
  cleanup();
  document.body.innerHTML = "";
});

describe("TikTokCard", () => {
  it("renders the thumbnail with localized alt text in EN", () => {
    render(<TikTokCard video={VIDEO} locale="en" />);
    const img = screen.getByAltText("Test bouquet thumbnail") as HTMLImageElement;
    expect(img.src).toContain("/tiktoks/test-bouquet.webp");
  });

  it("renders the localized alt text in ES", () => {
    render(<TikTokCard video={VIDEO} locale="es" />);
    expect(screen.getByAltText("Miniatura de ramo de prueba")).toBeDefined();
  });

  it("renders the views badge when views are present", () => {
    render(<TikTokCard video={VIDEO} locale="en" />);
    expect(screen.getByText("128K")).toBeDefined();
  });

  it("omits the views badge when views are absent", () => {
    const { views: _omit, ...rest } = VIDEO;
    render(<TikTokCard video={rest as TikTokVideo} locale="en" />);
    expect(screen.queryByText("128K")).toBeNull();
  });

  it("opens the lightbox iframe when clicked", () => {
    render(<TikTokCard video={VIDEO} locale="en" />);
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(iframe.src).toContain("tiktok.com/embed/v2/7300000000000000000");
  });
});
