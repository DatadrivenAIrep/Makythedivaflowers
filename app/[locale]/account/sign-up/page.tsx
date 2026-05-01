// app/[locale]/account/sign-up/page.tsx
import { AccountShell } from "@/components/account/AccountShell";
import { AuthForm } from "@/components/account/AuthForm";
import type { Locale } from "@/types/locale";

export default async function SignUpPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} activeTab="sign-up">
      <AuthForm mode="sign-up" />
    </AccountShell>
  );
}
