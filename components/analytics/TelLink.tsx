"use client";
import type { ReactNode } from "react";
import { trackPhoneClick } from "@/lib/analytics";
import type { EngagementLocation } from "@/lib/analytics-types";

type Props = {
  href: string;
  location: EngagementLocation;
  className?: string;
  children: ReactNode;
};

export function TelLink({ href, location, className, children }: Props) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackPhoneClick(location)}
    >
      {children}
    </a>
  );
}
