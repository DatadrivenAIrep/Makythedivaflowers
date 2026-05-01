// app/[locale]/account/orders/page.tsx
import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { OrdersEmpty } from "@/components/account/OrdersEmpty";
import type { Locale } from "@/types/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Mis pedidos — Diva Flowers" : "My Orders — Diva Flowers",
    alternates: {
      languages: {
        en: "/en/account/orders",
        es: "/es/account/orders",
      },
    },
  };
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} activeTab="orders">
      <OrdersEmpty locale={locale} />
    </AccountShell>
  );
}
