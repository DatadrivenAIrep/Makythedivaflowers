"use client";
import { memo, useCallback, useId, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FilterChip } from "./FilterChip";
import { SortDropdown } from "./SortDropdown";
import type { Filter, Sort } from "@/data/product-helpers";
import type { Locale } from "@/types/locale";
import { serializeFilterParams } from "@/lib/search-params";
import { trackOccasionSelected } from "@/lib/analytics";

type Props = {
  locale: Locale;
  filter: Filter;
  sort: Sort;
  show?: Array<"occasion" | "color" | "size" | "price" | "sameDay">;
};

const OCCASIONS = [
  "romance",
  "anniversary",
  "birthday",
  "congrats",
  "graduation",
  "new-baby",
  "thank-you",
  "get-well",
  "thinking-of-you",
  "sympathy",
  "just-because",
] as const;
const COLORS = ["pink", "red", "white", "mixed", "green", "pastel"] as const;
const SIZES = ["standard", "grand", "diva"] as const;
const PRICES = ["under-100", "100-150", "150-200", "200-plus"] as const;
const SORT_VALUES = ["recommended", "newest", "price-asc", "price-desc"] as const;

type Copy = { [k: string]: { en: string; es: string } };

const COPY: Copy = {
  filter_label: { en: "Filter", es: "Filtrar" },
  sort_label: { en: "Sort", es: "Ordenar" },
  same_day: { en: "Same-day", es: "Hoy" },
  clear: { en: "Clear", es: "Limpiar" },
  romance: { en: "Romance", es: "Romance" },
  anniversary: { en: "Anniversary", es: "Aniversario" },
  birthday: { en: "Birthday", es: "Cumpleaños" },
  congrats: { en: "Congratulations", es: "Felicitaciones" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  "just-because": { en: "Just because", es: "Sin razón" },
  "get-well": { en: "Get well", es: "Mejórate" },
  graduation: { en: "Graduation", es: "Graduación" },
  "new-baby": { en: "New baby", es: "Recién nacido" },
  "thank-you": { en: "Thank you", es: "Gracias" },
  "thinking-of-you": { en: "Thinking of you", es: "Pienso en ti" },
  pink: { en: "Pink", es: "Rosa" },
  red: { en: "Red", es: "Rojo" },
  white: { en: "White", es: "Blanco" },
  mixed: { en: "Mixed", es: "Mixto" },
  green: { en: "Green", es: "Verde" },
  pastel: { en: "Pastel", es: "Pastel" },
  standard: { en: "Standard", es: "Estándar" },
  grand: { en: "Grand", es: "Grandes" },
  diva: { en: "Diva", es: "Diva" },
  "under-100": { en: "Under $100", es: "Menos de $100" },
  "100-150": { en: "$100–$150", es: "$100–$150" },
  "150-200": { en: "$150–$200", es: "$150–$200" },
  "200-plus": { en: "$200+", es: "$200+" },
  recommended: { en: "Recommended", es: "Recomendados" },
  newest: { en: "Newest", es: "Más nuevos" },
  "price-asc": { en: "Price: low to high", es: "Precio: menor a mayor" },
  "price-desc": { en: "Price: high to low", es: "Precio: mayor a menor" },
};

function l(key: string, locale: Locale): string {
  return COPY[key]?.[locale] ?? key;
}

function FilterBarImpl({
  locale,
  filter,
  sort,
  show = ["occasion", "color", "size", "price", "sameDay"],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Phones keep the chips folded behind one button: unfolded they run to eight
  // or nine rows and push the arrangements off the first screen.
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const apply = useCallback(
    (next: { filter: Filter; sort: Sort }) => {
      const qs = serializeFilterParams(next);
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    },
    [router, pathname],
  );

  const toggle = useCallback(
    <K extends keyof Filter>(key: K, value: Filter[K]) => {
      const next: Filter = { ...filter };
      if (next[key] === value) delete (next as Record<string, unknown>)[key as string];
      else next[key] = value;
      apply({ filter: next, sort });
    },
    [filter, sort, apply],
  );

  const setSort = useCallback(
    (s: Sort) => {
      apply({ filter, sort: s });
    },
    [filter, sort, apply],
  );

  const clearAll = useCallback(() => {
    apply({ filter: {}, sort: "recommended" });
  }, [apply]);

  const sortOptions = useMemo(
    () => SORT_VALUES.map((v) => ({ value: v as Sort, label: l(v, locale) })),
    [locale],
  );

  const activeCount = Object.keys(filter).filter((k) => k !== "q").length;
  const hasAny = Object.keys(filter).length > 0 || sort !== "recommended";

  return (
    // Not sticky: pinned under the nav it took a third of a phone screen (more
    // with the chips open) away from the arrangements.
    <div className="-mx-6 border-y border-[var(--border)] px-6 py-3">
      <div className="mx-auto flex max-w-[var(--container-max)] flex-wrap items-center gap-x-3 gap-y-3 md:gap-x-6">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 font-sans text-sm tracking-tight text-ink md:hidden"
        >
          {l("filter_label", locale)}
          {activeCount > 0 && <span className="tabular-nums text-ink/60">({activeCount})</span>}
          <span aria-hidden="true" className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-mute-500 md:inline">
          {l("filter_label", locale)}
        </span>

        <div
          id={panelId}
          className={`${open ? "flex" : "hidden"} order-last w-full flex-wrap items-center gap-x-6 gap-y-3 md:order-none md:contents`}
        >
          {show.includes("occasion") &&
            OCCASIONS.map((o) => (
              <FilterChip
                key={o}
                label={l(o, locale)}
                selected={filter.occasion === o}
                onToggle={() => {
                  toggle("occasion", o);
                  trackOccasionSelected(o);
                }}
              />
            ))}

          {show.includes("color") && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-mute-500">
              ·
            </span>
          )}
          {show.includes("color") &&
            COLORS.map((c) => (
              <FilterChip
                key={c}
                label={l(c, locale)}
                selected={filter.color === c}
                onToggle={() => toggle("color", c)}
              />
            ))}

          {show.includes("size") &&
            SIZES.map((s) => (
              <FilterChip
                key={s}
                label={l(s, locale)}
                selected={filter.size === s}
                onToggle={() => toggle("size", s)}
              />
            ))}

          {show.includes("price") &&
            PRICES.map((p) => (
              <FilterChip
                key={p}
                label={l(p, locale)}
                selected={filter.price === p}
                onToggle={() => toggle("price", p)}
              />
            ))}

          {show.includes("sameDay") && (
            <FilterChip
              label={l("same_day", locale)}
              selected={Boolean(filter.sameDay)}
              onToggle={() => toggle("sameDay", true)}
            />
          )}
        </div>

        <span className="ml-auto flex items-center gap-3">
          {hasAny && (
            <button
              type="button"
              onClick={clearAll}
              className="font-sans text-sm tracking-tight text-ink/70 underline-offset-4 hover:underline"
            >
              {l("clear", locale)}
            </button>
          )}
          <SortDropdown
            value={sort}
            options={sortOptions}
            onChange={setSort}
            ariaLabel={l("sort_label", locale)}
          />
        </span>
      </div>
    </div>
  );
}

export const FilterBar = memo(FilterBarImpl);
