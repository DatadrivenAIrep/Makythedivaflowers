import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./types/locale";
import { verifySessionEdge } from "@/lib/admin-auth-edge";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

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
  const adminAuthResponse = await adminAuthMiddleware(req);
  if (adminAuthResponse) return adminAuthResponse;
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/api/admin/:path*",
  ],
};
