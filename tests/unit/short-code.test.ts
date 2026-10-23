import { describe, it, expect } from "vitest";
import { generateCode, CODE_PATTERN } from "@/lib/short-code";
import { generateCardCode } from "@/lib/digital-card-code";

describe("short-code", () => {
  it("makes 8-char base62 codes", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(CODE_PATTERN);
  });
  it("digital-card-code keeps its old name as an alias", () => {
    expect(generateCardCode()).toMatch(CODE_PATTERN);
  });
});
