import { describe, it, expect } from "vitest";
import { parseCampaign } from "@/lib/campaign-occasion";

describe("parseCampaign", () => {
  it("returns undefined for undefined input", () => {
    expect(parseCampaign(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseCampaign("")).toBeUndefined();
  });

  it("returns the value for a known occasion", () => {
    expect(parseCampaign("mothers-day")).toBe("mothers-day");
    expect(parseCampaign("anniversary")).toBe("anniversary");
  });

  it("returns undefined for unknown values", () => {
    expect(parseCampaign("hacker")).toBeUndefined();
    expect(parseCampaign("MOTHERS-DAY")).toBeUndefined();
  });

  it("takes the first element when given an array", () => {
    expect(parseCampaign(["mothers-day", "birthday"])).toBe("mothers-day");
    expect(parseCampaign(["junk", "anniversary"])).toBeUndefined();
  });
});
