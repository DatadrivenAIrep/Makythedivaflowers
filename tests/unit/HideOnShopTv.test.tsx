import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const usePathname = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathname() }));

import { HideOnShopTv } from "@/components/analytics/HideOnShopTv";

beforeEach(() => usePathname.mockReset());

describe("HideOnShopTv", () => {
  it("renders its children on regular pages", () => {
    usePathname.mockReturnValue("/en/shop");
    render(<HideOnShopTv><p>analytics</p></HideOnShopTv>);
    expect(screen.getByText("analytics")).toBeInTheDocument();
  });

  it("renders nothing on the shop TV", () => {
    usePathname.mockReturnValue("/en/vitrina");
    render(<HideOnShopTv><p>analytics</p></HideOnShopTv>);
    expect(screen.queryByText("analytics")).not.toBeInTheDocument();
  });
});
