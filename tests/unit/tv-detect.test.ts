import { describe, it, expect } from "vitest";
import { newPaidIds, paginate } from "@/components/admin/tv/tv-detect";

describe("tv-detect", () => {
  it("newPaidIds returns ids not already seen", () => {
    const events = [
      { orderId: "a", at: "t", recipientName: "A" },
      { orderId: "b", at: "t", recipientName: "B" },
    ];
    expect(newPaidIds(events, new Set(["a"]))).toEqual(["b"]);
    expect(newPaidIds(events, new Set(["a", "b"]))).toEqual([]);
  });

  it("paginate splits into fixed-size pages", () => {
    expect(paginate([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([[1, 2, 3, 4, 5, 6], [7]]);
    expect(paginate([], 6)).toEqual([[]]);
    expect(paginate([1, 2], 6)).toEqual([[1, 2]]);
  });
});
