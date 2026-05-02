import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// stub next-intl
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

// placeholder — real import added in Task 3
describe("MobileMenuButton placeholder", () => {
  it("true is true", () => {
    expect(true).toBe(true);
  });
});
