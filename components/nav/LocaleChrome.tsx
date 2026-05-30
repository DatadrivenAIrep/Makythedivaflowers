"use client";
import { usePathname } from "next/navigation";

type Props = {
  topNav: React.ReactNode;
  footer: React.ReactNode;
  extras: React.ReactNode;
  children: React.ReactNode;
};

export function LocaleChrome({ topNav, footer, extras, children }: Props) {
  const pathname = usePathname();
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname);

  if (isAdmin) return <>{children}</>;

  return (
    <>
      {topNav}
      <div className="pt-16">{children}</div>
      {footer}
      {extras}
    </>
  );
}
