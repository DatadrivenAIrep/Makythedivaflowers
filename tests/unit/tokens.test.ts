import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tokens = readFileSync(resolve(__dirname, "../../styles/tokens.css"), "utf8");
const globals = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

describe("foundation tokens", () => {
  it("defines a base-8 spacing scale", () => {
    for (const t of ["--space-1", "--space-2", "--space-4", "--space-8"]) {
      expect(tokens).toContain(t);
    }
  });
  it("defines the type scale as size/leading/tracking sets", () => {
    for (const t of [
      "--text-display-size", "--text-display-leading", "--text-display-tracking",
      "--text-body-size", "--text-body-leading", "--text-body-tracking",
    ]) {
      expect(tokens).toContain(t);
    }
  });
  it("defines material tokens for translucent chrome", () => {
    for (const t of ["--material-blur", "--material-saturate", "--material-bg", "--material-edge"]) {
      expect(tokens).toContain(t);
    }
  });
  it("defines semantic surface roles", () => {
    for (const t of ["--bg", "--fg", "--surface", "--border"]) {
      expect(tokens).toContain(t);
    }
  });
  it("activates dark values via [data-theme=dark] (opt-in, not auto)", () => {
    expect(tokens).toMatch(/\[data-theme=["']?dark["']?\]/);
  });
});

describe("globals a11y + type", () => {
  it("enables optical sizing", () => {
    expect(globals).toContain("font-optical-sizing");
  });
  it("has reduced-transparency and contrast blocks", () => {
    expect(globals).toContain("prefers-reduced-transparency");
    expect(globals).toContain("prefers-contrast");
  });
});
