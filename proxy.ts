import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./types/locale";
import { verifySessionEdge } from "@/lib/admin-auth-edge";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
  // The pages already emit hreflang <link> tags (lib/seo/alternates.ts) with
  // x-default -> /en/.... The middleware's own `Link` header pointed x-default
  // at the UNPREFIXED url instead, which only redirects: Google crawled 202 of
  // those and filed them under "page with redirect".
  alternateLinks: false,
});

/**
 * next-intl sends `/` and every unprefixed path to its locale with a 307.
 * A temporary redirect tells Google to keep the source URL, so the home was
 * indexed three times over (`http://…/`, `/` and `/en`) with its clicks split.
 * Re-issue those as 308 so the signals consolidate on the prefixed URL.
 * The target depends on the visitor's language, so no shared cache may keep it.
 */
function permanentLocaleRedirect(req: NextRequest, res: NextResponse): NextResponse {
  if (res.status !== 307) return res;
  const location = res.headers.get("location");
  if (!location) return res;
  const { pathname } = req.nextUrl;
  if (locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return res;
  const target = new URL(location, req.url);
  if (!locales.some((l) => target.pathname === `/${l}` || target.pathname.startsWith(`/${l}/`))) return res;
  const out = NextResponse.redirect(target, 308);
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") out.headers.append(key, value);
  });
  out.headers.set("Cache-Control", "private, no-cache");
  out.headers.set("Vary", "Accept-Language, Cookie");
  return out;
}

const SESSION_COOKIE = "intake_session";

const PROTECTED_PREFIXES = ["/admin", "/en/admin", "/es/admin"];
const PROTECTED_API_PREFIX = "/api/admin";
const PUBLIC_ADMIN = ["/admin/login", "/en/admin/login", "/es/admin/login"];
const PUBLIC_API = ["/api/admin/session"];

function isProtectedUi(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !PUBLIC_ADMIN.includes(pathname);
}

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith(PROTECTED_API_PREFIX) && !PUBLIC_API.includes(pathname);
}

async function adminAuthMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedUi(pathname) && !isProtectedApi(pathname)) {
    return null;
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const ok = await verifySessionEdge(token);
  if (ok) return null;
  if (isProtectedApi(pathname)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = pathname.startsWith("/es/") ? "/es/admin/login" : "/en/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // API routes should never go through the intl middleware.
  if (pathname.startsWith("/api/")) {
    const adminAuthResponse = await adminAuthMiddleware(req);
    if (adminAuthResponse) return adminAuthResponse;
    return NextResponse.next();
  }
  const adminAuthResponse = await adminAuthMiddleware(req);
  if (adminAuthResponse) return adminAuthResponse;
  return permanentLocaleRedirect(req, intlMiddleware(req));
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|c/|s/|i/|.*\\..*).*)",
    "/api/admin/:path*",
  ],
};
