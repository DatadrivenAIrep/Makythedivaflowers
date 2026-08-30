import type { Metadata } from "next";
import { locales, type Locale } from "@/types/locale";

/**
 * Canonical + hreflang for one page, in every locale.
 *
 * Two things this centralises that the hand-written blocks kept getting wrong:
 *  - `x-default`, which Google wants so it knows what to serve a searcher whose
 *    language matches neither locale. Not one page had it.
 *  - a self-referencing canonical on every page, not just some of them.
 *
 * Paths are locale-relative and start with "/" (or "" for the homepage):
 *   localeAlternates("es", "/shop") -> canonical /es/shop, hreflang en|es|x-default
 *
 * URLs are emitted relative; Next resolves them against `metadataBase`
 * (set in app/layout.tsx) into the absolute URLs hreflang requires.
 */
export function localeAlternates(locale: Locale, path = ""): Metadata["alternates"] {
  const p = path && !path.startsWith("/") ? `/${path}` : path;
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `/${l}${p}`]),
    ["x-default", `/en${p}`],
  ]);
  return { canonical: `/${locale}${p}`, languages };
}
