export type SubjectKey =
  | "pdp_named"
  | "pdp_generic"
  | "shop_all"
  | "shop_category"
  | "weddings"
  | "events"
  | "sympathy"
  | "prom"
  | "corsages"
  | "checkout"
  | "default";

export type ContactOverride =
  | { kind: "pdp"; productName: string }
  | { kind: "shop"; category: string }
  | null;

export type SubjectResult = { key: SubjectKey; vars?: Record<string, string> };

const LOCALE_PREFIX = /^\/(en|es)(?=\/|$)/;

function stripLocale(pathname: string): string {
  const stripped = pathname.replace(LOCALE_PREFIX, "");
  return stripped === "" ? "/" : stripped.replace(/\/+$/, "") || "/";
}

export function getSubjectKey(input: {
  pathname: string;
  override: ContactOverride;
}): SubjectResult {
  const { pathname, override } = input;

  if (override && override.kind === "pdp") {
    return { key: "pdp_named", vars: { product: override.productName } };
  }
  if (override && override.kind === "shop") {
    return { key: "shop_category", vars: { category: override.category } };
  }

  const path = stripLocale(pathname);

  if (path.startsWith("/product/")) return { key: "pdp_generic" };
  if (path === "/shop" || path.startsWith("/shop/")) return { key: "shop_all" };
  if (path === "/weddings") return { key: "weddings" };
  if (path === "/events") return { key: "events" };
  if (path === "/sympathy") return { key: "sympathy" };
  if (path === "/prom") return { key: "prom" };
  if (path === "/corsages-boutonnieres") return { key: "corsages" };
  if (path === "/cart" || path === "/checkout") return { key: "checkout" };

  return { key: "default" };
}

export function isAllowlistedRoute(pathname: string): boolean {
  if (stripLocale(pathname) === "/") return true;
  return getSubjectKey({ pathname, override: null }).key !== "default";
}
