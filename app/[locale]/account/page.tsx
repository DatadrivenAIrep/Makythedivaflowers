// app/[locale]/account/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { SignInForm } from "@/components/account/SignInForm";
import { verifyCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth";
import type { Locale } from "@/types/locale";
import { localeAlternates } from "@/lib/seo/alternates";

// Reads a session cookie, so it can never be prerendered or cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Iniciar sesión — Diva Flowers" : "Sign In — Diva Flowers",
    alternates: localeAlternates(locale, "/account"),
    robots: { index: false },
  };
}

export default async function SignInPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value ?? "";
  if (verifyCustomerSession(token)) redirect(`/${locale}/account/orders`);

  return (
    <AccountShell locale={locale} activeTab="sign-in">
      <SignInForm locale={locale} />
    </AccountShell>
  );
}
