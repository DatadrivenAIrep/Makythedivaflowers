"use client";
import { useSetContactSubject } from "@/components/contact/ContactContextProvider";

export function ShopCategoryContactSubject({ category }: { category: string }) {
  useSetContactSubject({ kind: "shop", category });
  return null;
}
