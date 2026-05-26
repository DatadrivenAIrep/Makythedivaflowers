"use client";
import { memo, useCallback, useMemo } from "react";
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
  "get-well",
  "sympathy",
  "just-because",
] as const;
const COLORS = ["pink", "red", "white", "mixed", "green", "pastel"] as const;
const SIZES = ["standard", "grand", "diva"] as const;
const PRICES = ["under-200", "200-300", "300-plus"] as const;
const SORT_VALUES = ["newest", "price-asc", "price-desc", "staff-pick"] as const;

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
  pink: { en: "Pink", es: "Rosa" },
  red: { en: "Red", es: "Rojo" },
  white: { en: "White", es: "Blanco" },
  mixed: { en: "Mixed", es: "Mixto" },
  green: { en: "Green", es: "Verde" },
  pastel: { en: "Pastel", es: "Pastel" },
  standard: { en: "Standard", es: "Estándar" },
  grand: { en: "Grand", es: "Grandes" },
  diva: { en: "Diva", es: "Diva" },
  "under-200": { en: "Under $200", es: "Menos de $200" },
  "200-300": { en: "$200–$300", es: "$200–$300" },
  "300-plus": { en: "$300+", es: "$300+" },
  newest: { en: "Newest", es: "Más nuevos" },
  "price-asc": { en: "Price: low to high", es: "Precio: menor a mayor" },
  "price-desc": { en: "Price: high to low", es: "Precio: mayor a menor" },
  "staff-pick": { en: "Staff picks", es: "Selección" },
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
    apply({ filter: {}, sort: "newest" });
  }, [apply]);

  const sortOptions = useMemo(
    () => SORT_VALUES.map((v) => ({ value: v as Sort, label: l(v, locale) })),
    [locale],
  );

  const hasAny = Object.keys(filter).length > 0 || sort !== "newest";

  return (
    <div className="sticky top-16 z-30 -mx-6 border-y border-ink/10 bg-bone/85 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-bone/70">
      <div className="mx-auto flex max-w-[var(--container-max)] flex-wrap items-center gap-x-6 gap-y-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
          {l("filter_label", locale)}
        </span>

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
