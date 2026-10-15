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

  it("crops a full-bleed photo under a dark gradient by default (venue photos)", () => {
    render(<PhotoPanel src="/weddings/01.webp" alt="Venue" eyebrow="A" title="T" />);
    expect(screen.getByRole("img", { name: "Venue" }).className).toContain("object-cover");
    expect(screen.queryByTestId("floating-photo")).toBeNull();
  });

  it("in float mode shows the whole arrangement on plaster with dark text, uncropped", () => {
    render(<PhotoPanel float src="/products/cotton-candy.jpg" alt="Plan" eyebrow="A" title="Float title" />);
    expect(screen.getByTestId("floating-photo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Plan" }).className).not.toContain("object-cover");
    expect(screen.getByTestId("photo-panel").className).toContain("bg-mute-100");
    expect(screen.getByRole("heading", { level: 2, name: "Float title" }).closest("div")?.className).toContain("text-ink");
  });
});
