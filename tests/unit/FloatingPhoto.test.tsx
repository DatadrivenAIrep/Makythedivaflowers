import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingPhoto } from "@/components/product/FloatingPhoto";

vi.mock("@/lib/product-image-dims", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-image-dims")>();
  const sizes: Record<string, { width: number; height: number }> = {
    "/products/known.jpg": { width: 1800, height: 2400 },
  };
  return { ...actual, productImageDims: (src: string) => sizes[src] ?? null };
});

describe("FloatingPhoto", () => {
  it("renders the whole photo at its own proportions when its size is known", () => {
    render(<FloatingPhoto src="/products/known.jpg" alt="Known" sizes="200px" />);
    const img = screen.getByRole("img", { name: "Known" });
    expect(img.getAttribute("width")).toBe("1800");
    expect(img.getAttribute("height")).toBe("2400");
    expect(img.className).toContain("max-h-full");
    expect(img.className).toContain("max-w-full");
    expect(img.className).not.toContain("object-cover");
  });

  it("falls back to an uncropped fill when the photo was never measured", () => {
    render(<FloatingPhoto src="/products/unknown.jpg" alt="Unknown" sizes="200px" />);
    const img = screen.getByRole("img", { name: "Unknown" });
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");
  });

  it("feathers the photo edges into the background", () => {
    render(<FloatingPhoto src="/products/known.jpg" alt="Known" sizes="200px" />);
    expect(screen.getByRole("img", { name: "Known" }).className).toContain("mask-x-from-");
  });

  it("rests the photo on the bottom of its stage", () => {
    render(<FloatingPhoto src="/products/known.jpg" alt="Known" sizes="200px" />);
    const stage = screen.getByTestId("floating-photo");
    expect(stage.className).toContain("items-end");
  });

  it("gives its row a definite height so tall photos shrink instead of overflowing", () => {
    render(<FloatingPhoto src="/products/known.jpg" alt="Known" sizes="200px" />);
    expect(screen.getByTestId("floating-photo").className).toContain("grid-rows-1");
    expect(screen.getByRole("img", { name: "Known" }).className).toContain("min-h-0");
  });
});
