import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhotoPanel } from "@/components/ui/form/shell/PhotoPanel";

describe("PhotoPanel", () => {
  it("renders eyebrow, title, and body", () => {
    render(
      <PhotoPanel
        src="/weddings/01.webp"
        alt=""
        eyebrow="Weddings"
        title="A wedding is a single afternoon."
        body="We respond within one business day."
      />,
    );
    expect(screen.getByText("Weddings")).toBeInTheDocument();
    expect(screen.getByText(/single afternoon/i)).toBeInTheDocument();
    expect(screen.getByText(/respond within one business day/i)).toBeInTheDocument();
  });

  it("renders title as an h2 for hierarchy", () => {
    render(<PhotoPanel src="/x.jpg" alt="" eyebrow="A" title="The title" />);
    expect(screen.getByRole("heading", { level: 2, name: "The title" })).toBeInTheDocument();
  });
});
