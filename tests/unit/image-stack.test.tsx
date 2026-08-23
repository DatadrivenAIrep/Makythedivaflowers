import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageStack } from "@/components/product/ImageStack";
import type { Product } from "@/types/product";

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

const product = {
  images: [
    { src: "/a.webp", alt: { en: "Alpha", es: "Alpha" }, aspect: "4/5" },
    { src: "/b.webp", alt: { en: "Beta", es: "Beta" }, aspect: "4/5" },
    { src: "/c.webp", alt: { en: "Gamma", es: "Gamma" }, aspect: "4/5" },
  ],
} as unknown as Product;

describe("ImageStack", () => {
  it("renders every image and a thumbnail per image", () => {
    render(<ImageStack product={product} locale="en" />);
    // main track has all images; thumbnails mirror them → each alt appears
    expect(screen.getAllByAltText("Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("Gamma").length).toBeGreaterThan(0);
    // one thumbnail button per image
    expect(screen.getAllByRole("button").length).toBe(3);
  });

  it("selecting a thumbnail marks it current", () => {
    render(<ImageStack product={product} locale="en" />);
    const thumbs = screen.getAllByRole("button");
    fireEvent.click(thumbs[2]!);
    expect(thumbs[2]).toHaveAttribute("aria-current", "true");
  });

  it("renders a single image without crashing (no track)", () => {
    const one = { images: [product.images[0]] } as unknown as Product;
    render(<ImageStack product={one} locale="en" />);
    expect(screen.getByAltText("Alpha")).toBeInTheDocument();
  });
});
