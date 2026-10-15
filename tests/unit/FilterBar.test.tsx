import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/es/shop",
}));

import { FilterBar } from "@/components/product/FilterBar";

describe("FilterBar", () => {
  it("is not pinned to the screen", () => {
    const { container } = render(<FilterBar locale="es" filter={{}} sort="recommended" />);
    expect(container.querySelector(".sticky")).toBeNull();
  });

  it("folds the chips behind a Filtrar button that counts active filters", () => {
    render(<FilterBar locale="es" filter={{ occasion: "birthday", sameDay: true }} sort="recommended" />);
    const toggle = screen.getByRole("button", { name: /Filtrar/ });
    expect(toggle).toHaveTextContent("(2)");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(panel.className).toMatch(/(^|\s)hidden(\s|$)/);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(panel).toHaveTextContent("Cumpleaños");
  });
});
