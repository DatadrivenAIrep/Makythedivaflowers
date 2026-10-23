"use client";
import { usePathname } from "next/navigation";
import { isShopTvPath } from "@/lib/bare-paths";

/**
 * The shop TV reloads about 48 times a day and nobody there can convert, so
 * analytics scripts are skipped on /vitrina to keep GA/Clarity data clean.
 */
export function HideOnShopTv({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && isShopTvPath(pathname)) return null;
  return <>{children}</>;
}
