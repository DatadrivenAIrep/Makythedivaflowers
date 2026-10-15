"use client";
import { usePathname } from "next/navigation";
import { isBarePath } from "@/lib/bare-paths";

type Props = {
  topNav: React.ReactNode;
  footer: React.ReactNode;
  extras: React.ReactNode;
  children: React.ReactNode;
};

export function LocaleChrome({ topNav, footer, extras, children }: Props) {
  const pathname = usePathname();
  // Admin and the shop TV (/vitrina) run full-screen, without the site chrome.
  const isBare = isBarePath(pathname);

  if (isBare) return <>{children}</>;

  return (
    <>
      {topNav}
      <div className="pt-[var(--nav-offset)]">{children}</div>
      {footer}
      {extras}
    </>
  );
}
