// app/[locale]/account/sign-up/page.tsx
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
    title: locale === "es" ? "Crear cuenta — Diva Flowers" : "Create Account — Diva Flowers",
    alternates: {
      languages: {
        en: "/en/account/sign-up",
        es: "/es/account/sign-up",
      },
    },
  };
}

export default async function SignUpPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} activeTab="sign-up">
      <AuthForm mode="sign-up" />
    </AccountShell>
  );
}
