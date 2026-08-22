import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerticalTeaser } from "@/components/home/VerticalTeaser";

describe("VerticalTeaser", () => {
  it("renders the copy and links to the destination", () => {
    render(
      <VerticalTeaser
        eyebrow="Weddings" title="Say it with flowers" cta="Explore weddings"
        imageSrc="/weddings/oh1-scaled.webp"
        href="/en/weddings"
      />,
    );
    expect(screen.getByText("Say it with flowers")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Explore weddings/i });
    expect(link).toHaveAttribute("href", "/en/weddings");
  });
});
