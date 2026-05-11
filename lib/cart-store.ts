import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartLine = {
  productId: string;
  variantId: string;
  addOnIds: string[];
  qty: number;
};

type CartState = {
  lines: CartLine[];
  cardMessage: string;
  add: (line: CartLine) => void;
  setCardMessage: (msg: string) => void;
  remove: (productId: string, variantId: string) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  clear: () => void;
  count: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      cardMessage: "",
      add: (line) =>
        set((state) => {
          const existingIdx = state.lines.findIndex(
            (l) => l.productId === line.productId && l.variantId === line.variantId,
          );
          if (existingIdx >= 0) {
            const next = [...state.lines];
            next[existingIdx] = { ...next[existingIdx], qty: next[existingIdx].qty + line.qty };
            return { lines: next };
          }
          return { lines: [...state.lines, line] };
        }),
      setCardMessage: (msg) => set({ cardMessage: msg }),
      remove: (productId, variantId) =>
        set((state) => ({
          lines: state.lines.filter((l) => !(l.productId === productId && l.variantId === variantId)),
        })),
      setQty: (productId, variantId, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.productId === productId && l.variantId === variantId ? { ...l, qty } : l,
            )
            .filter((l) => l.qty > 0),
        })),
      clear: () => set({ lines: [], cardMessage: "" }),
      count: () => get().lines.reduce((s, l) => s + l.qty, 0),
    }),
    { name: "diva-cart" },
  ),
);
