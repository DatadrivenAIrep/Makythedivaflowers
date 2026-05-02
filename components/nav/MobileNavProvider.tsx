"use client";
import { useState, useCallback } from "react";
import { MobileMenuButton } from "@/components/nav/MobileMenuButton";
import { MobileDrawer } from "@/components/nav/MobileDrawer";
import type { Locale } from "@/types/locale";

export function MobileNavProvider({ locale }: { locale: Locale }) {
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <>
      <MobileMenuButton onClick={() => setIsOpen(true)} />
      <MobileDrawer isOpen={isOpen} onClose={close} locale={locale} />
    </>
  );
}
