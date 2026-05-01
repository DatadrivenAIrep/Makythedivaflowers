// app/[locale]/account/page.tsx
import { AccountShell } from "@/components/account/AccountShell";
import { AuthForm } from "@/components/account/AuthForm";
import type { Locale } from "@/types/locale";

export default async function SignInPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} activeTab="sign-in">
      <AuthForm mode="sign-in" />
    </AccountShell>
  );
}
