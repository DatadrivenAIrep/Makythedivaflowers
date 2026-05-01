import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/lib/cart-store";

describe("cartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [] });
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("adds a new line", () => {
    useCartStore.getState().add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  it("merges qty when adding the same product+variant twice", () => {
    const { add } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 2 });
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0].qty).toBe(3);
  });

  it("treats different variants as separate lines", () => {
    const { add } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 1 });
    add({ productId: "p1", variantId: "v2", addOnIds: [], qty: 1 });
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it("setQty to 0 removes the line", () => {
    const { add, setQty } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 2 });
    setQty("p1", "v1", 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("count sums qty across lines", () => {
    const { add, count } = useCartStore.getState();
    add({ productId: "p1", variantId: "v1", addOnIds: [], qty: 2 });
    add({ productId: "p2", variantId: "v1", addOnIds: [], qty: 3 });
    expect(count()).toBe(5);
  });
});
