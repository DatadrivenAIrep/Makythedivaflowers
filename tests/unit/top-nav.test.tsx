import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopNav } from "@/components/nav/TopNav";

vi.mock("@/components/nav/LocaleSwitcher", () => ({ LocaleSwitcher: () => <div /> }));
vi.mock("@/components/nav/CartButton", () => ({ CartButton: () => <div /> }));

describe("TopNav", () => {
  it("renders a banner with the logo home link and its slots", () => {
    render(<TopNav locale="en" navLinksSlot={<nav>links</nav>} mobileMenuSlot={<div>menu</div>} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByText("links")).toBeInTheDocument();
  });

  it("is a translucent material (content scrolls under)", () => {
    render(<TopNav locale="en" navLinksSlot={<nav>links</nav>} />);
    expect(screen.getByRole("banner").className).toMatch(/backdrop-filter|material-bg/);
  });
});
