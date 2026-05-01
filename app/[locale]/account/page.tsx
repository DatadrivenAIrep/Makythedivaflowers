// app/[locale]/account/page.tsx
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { AuthForm } from "@/components/account/AuthForm";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Iniciar sesión — Diva Flowers" : "Sign In — Diva Flowers",
    alternates: {
      languages: {
        en: "/en/account",
        es: "/es/account",
      },
    },
  };
}

export default async function SignInPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} activeTab="sign-in">
      <AuthForm mode="sign-in" />
    </AccountShell>
  );
}
