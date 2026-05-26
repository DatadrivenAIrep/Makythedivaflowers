"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Locale } from "@/types/locale";

const COPY = {
  placeholder: {
    en: "Search bouquets, plants, occasions…",
    es: "Buscar ramos, plantas, ocasiones…",
  },
  label: { en: "Search the shop", es: "Buscar en la tienda" },
  clear: { en: "Clear search", es: "Limpiar búsqueda" },
} as const;

export function SearchBox({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    if (urlQ !== value) setValue(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="relative flex items-center"
    >
      <label htmlFor="shop-search" className="sr-only">
        {COPY.label[locale]}
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-4 h-4 w-4 text-ink/50"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        id="shop-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={COPY.placeholder[locale]}
        className="h-12 w-full rounded-full border border-ink/15 bg-bone pl-11 pr-12 font-sans text-base text-ink placeholder:text-ink/40 focus:border-ink/40 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label={COPY.clear[locale]}
          className="absolute right-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </form>
  );
}
