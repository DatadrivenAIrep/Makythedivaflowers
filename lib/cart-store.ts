import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, CatalogCartLine } from "@/types/order";

export type { CartLine } from "@/types/order";

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
          if (line.kind === "catalog") {
            const existingIdx = state.lines.findIndex(
              (l) =>
                l.kind === "catalog" &&
                l.productId === line.productId &&
                l.variantId === line.variantId,
            );
            if (existingIdx >= 0) {
              const next = [...state.lines];
              const cur = next[existingIdx] as CatalogCartLine;
              next[existingIdx] = { ...cur, qty: cur.qty + line.qty };
              return { lines: next };
            }
          }
          return { lines: [...state.lines, line] };
        }),
      setCardMessage: (msg) => set({ cardMessage: msg }),
      remove: (productId, variantId) =>
        set((state) => ({
          lines: state.lines.filter(
            (l) =>
              !(l.kind === "catalog" && l.productId === productId && l.variantId === variantId),
          ),
        })),
      setQty: (productId, variantId, qty) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.kind === "catalog" && l.productId === productId && l.variantId === variantId
                ? { ...l, qty }
                : l,
            )
            .filter((l) => l.qty > 0),
        })),
      clear: () => set({ lines: [], cardMessage: "" }),
      count: () => get().lines.reduce((s, l) => s + l.qty, 0),
    }),
    { name: "diva-cart", version: 2 },
  ),
);
