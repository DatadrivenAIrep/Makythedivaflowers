// lib/ui-store.ts
"use client";
import { create } from "zustand";

type ToastKind = "added-to-bag" | "inquiry-sent" | "newsletter-sent";

type UIState = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toast: { kind: ToastKind; productId?: string } | null;
  showToast: (t: { kind: ToastKind; productId?: string }) => void;
  clearToast: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  toast: null,
  showToast: (t) => set({ toast: t }),
  clearToast: () => set({ toast: null }),
}));
