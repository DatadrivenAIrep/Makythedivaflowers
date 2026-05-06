"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/types/locale";

const HIDE_AFTER_UTC_MS = Date.UTC(2026, 4, 10, 20, 0, 0); // 2026-05-10T20:00:00Z = MD 4 PM ET
const STORAGE_KEY = "md2026-strip-dismissed";

export function MothersDayHomeStrip({ locale }: { locale: Locale }) {
  const t = useTranslations("mothers_day");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Date.now() >= HIDE_AFTER_UTC_MS) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="bg-rouge text-bone">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <a href={`/${locale}/mothers-day`} className="flex-1 hover:underline">
          {t("home_strip")}
        </a>
        <button
          aria-label={t("home_strip_dismiss")}
          onClick={() => {
            window.localStorage.setItem(STORAGE_KEY, "1");
            setShow(false);
          }}
          className="text-bone/80 hover:text-bone"
        >
          ×
        </button>
      </div>
    </div>
  );
}
