import { describe, it, expect } from "vitest";
import { allocate } from "@/lib/house-account-allocate";

const T = [{ id: "a", dueCents: 5000 }, { id: "b", dueCents: 3000 }, { id: "c", dueCents: 2000 }];

describe("allocate", () => {
  it("exact: covers everything in order", () => {
    expect(allocate(T, 10000)).toEqual([{ id: "a", appliedCents: 5000 }, { id: "b", appliedCents: 3000 }, { id: "c", appliedCents: 2000 }]);
  });
  it("partial: oldest first, the last one gets the remainder", () => {
    expect(allocate(T, 6500)).toEqual([{ id: "a", appliedCents: 5000 }, { id: "b", appliedCents: 1500 }]);
  });
  it("overpayment: applies all dues, leaves the surplus to the caller", () => {
    expect(allocate(T, 12000)).toEqual([{ id: "a", appliedCents: 5000 }, { id: "b", appliedCents: 3000 }, { id: "c", appliedCents: 2000 }]);
  });
  it("skips targets with nothing due", () => {
    expect(allocate([{ id: "a", dueCents: 0 }, { id: "b", dueCents: -5 }, { id: "c", dueCents: 700 }], 1000)).toEqual([{ id: "c", appliedCents: 700 }]);
  });
  it("zero, negative or non-integer amounts allocate nothing", () => {
    expect(allocate(T, 0)).toEqual([]);
    expect(allocate(T, -1)).toEqual([]);
    expect(allocate(T, 10.5)).toEqual([]);
    expect(allocate([], 100)).toEqual([]);
  });
});
