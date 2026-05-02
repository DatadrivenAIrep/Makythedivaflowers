import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GalleryMosaic } from "@/components/weddings/gallery/GalleryMosaic";
import { weddingPortfolio } from "@/data/wedding-portfolio";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("GalleryMosaic", () => {
  it("renders one image per photo passed in", () => {
    const slice = weddingPortfolio.slice(0, 5);
    const indices = [0, 1, 2, 3, 4];
    render(<GalleryMosaic photos={slice} indices={indices} locale="en" onOpen={() => {}} />);
    slice.forEach((p) => {
      expect(screen.getByAltText(p.alt.en)).toBeInTheDocument();
    });
  });

  it("renders index labels using the global indices", () => {
    const slice = weddingPortfolio.slice(0, 3);
    render(<GalleryMosaic photos={slice} indices={[0, 1, 2]} locale="en" onOpen={() => {}} />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
