// app/[locale]/account/dates/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { MyDates } from "@/components/account/MyDates";
import { verifyCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
import { accountDatesView } from "@/lib/account-dates";
import type { Locale } from "@/types/locale";
import { localeAlternates } from "@/lib/seo/alternates";

// One customer's dates: never prerendered, never cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Mis fechas — Diva Flowers" : "My dates — Diva Flowers",
    alternates: localeAlternates(locale, "/account/dates"),
    robots: { index: false },
  };
}

export default async function DatesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!dateRewardsEnabled()) notFound();
  const customerId = verifyCustomerSession(
    (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value ?? "",
  );
  if (!customerId) redirect(`/${locale}/account`);

  const view = accountDatesView(customerId);

  return (
    <AccountShell locale={locale} activeTab="dates">
      <MyDates locale={locale} initial={view} />
    </AccountShell>
  );
}
