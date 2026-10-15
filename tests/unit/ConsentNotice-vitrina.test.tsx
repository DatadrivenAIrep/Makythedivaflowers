import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/en/shop";
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  usePathname: () => pathname,
}));

import { ConsentNotice } from "@/components/analytics/ConsentNotice";

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const eq = c.indexOf("=");
    const name = (eq > -1 ? c.substring(0, eq) : c).trim();
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

describe("ConsentNotice on the shop TV", () => {
  beforeEach(() => clearCookies());

  it("shows on normal pages when there is no consent cookie", () => {
    pathname = "/en/shop";
    render(<ConsentNotice />);
    expect(screen.getByRole("region", { name: "Cookie notice" })).toBeInTheDocument();
  });

  it("does not show on /vitrina (nobody can click it on the TV)", () => {
    pathname = "/en/vitrina";
    render(<ConsentNotice />);
    expect(screen.queryByRole("region", { name: "Cookie notice" })).toBeNull();
  });
});
