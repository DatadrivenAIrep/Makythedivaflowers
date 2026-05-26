import type { Filter, Sort } from "@/data/product-helpers";

const OCCASIONS = ["birthday", "anniversary", "sympathy", "romance", "congrats", "just-because", "get-well"] as const;
const COLORS = ["pink", "red", "white", "mixed", "green", "pastel"] as const;
const SIZES = ["standard", "grand", "diva"] as const;
const PRICES = ["under-200", "200-300", "300-plus"] as const;
const SORTS = ["newest", "price-asc", "price-desc", "staff-pick"] as const;

function pickEnum<T extends readonly string[]>(
  list: T,
  v: string | undefined,
): T[number] | undefined {
  return v && (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parseFilterParams(params: RawSearchParams): { filter: Filter; sort: Sort } {
  const occasion = pickEnum(OCCASIONS, first(params.occasion));
  const color = pickEnum(COLORS, first(params.color));
  const size = pickEnum(SIZES, first(params.size));
  const price = pickEnum(PRICES, first(params.price));
  const sameDayRaw = first(params.same_day);
  const sameDay = sameDayRaw === "1" || sameDayRaw === "true" ? true : undefined;
  const sort = pickEnum(SORTS, first(params.sort)) ?? "newest";
  const qRaw = first(params.q);
  const q = qRaw ? qRaw.trim().slice(0, 80) : undefined;

  const filter: Filter = {};
  if (occasion) filter.occasion = occasion;
  if (color) filter.color = color;
  if (size) filter.size = size;
  if (price) filter.price = price;
  if (sameDay) filter.sameDay = true;
  if (q) filter.q = q;

  return { filter, sort };
}

export function serializeFilterParams({
  filter,
  sort,
}: {
  filter: Filter;
  sort: Sort;
}): string {
  const params = new URLSearchParams();
  if (filter.occasion) params.set("occasion", filter.occasion);
  if (filter.color) params.set("color", filter.color);
  if (filter.size) params.set("size", filter.size);
  if (filter.price) params.set("price", filter.price);
  if (filter.sameDay) params.set("same_day", "1");
  if (filter.q) params.set("q", filter.q);
  if (sort !== "newest") params.set("sort", sort);
  return params.toString();
}
