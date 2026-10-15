import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let pathname = "/en";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { LocaleChrome } from "@/components/nav/LocaleChrome";

function renderAt(path: string) {
  pathname = path;
  return render(
    <LocaleChrome topNav={<nav>NAV</nav>} footer={<footer>FOOT</footer>} extras={<div>EXTRAS</div>}>
      <main>PAGE</main>
    </LocaleChrome>,
  );
}

it("wraps public pages with the site chrome", () => {
  renderAt("/en/shop");
  expect(screen.getByText("NAV")).toBeInTheDocument();
  expect(screen.getByText("EXTRAS")).toBeInTheDocument();
});

it("shows the shop TV bare", () => {
  renderAt("/en/vitrina");
  expect(screen.getByText("PAGE")).toBeInTheDocument();
  expect(screen.queryByText("NAV")).toBeNull();
  expect(screen.queryByText("FOOT")).toBeNull();
  expect(screen.queryByText("EXTRAS")).toBeNull();
});

it("still shows admin bare", () => {
  renderAt("/es/admin/tv");
  expect(screen.queryByText("NAV")).toBeNull();
});

it("does not match look-alike paths", () => {
  renderAt("/en/vitrinas-de-boda");
  expect(screen.getByText("NAV")).toBeInTheDocument();
});
