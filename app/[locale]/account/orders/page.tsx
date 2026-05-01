// app/[locale]/account/orders/page.tsx
import { AccountShell } from "@/components/account/AccountShell";
import { OrdersEmpty } from "@/components/account/OrdersEmpty";
import type { Locale } from "@/types/locale";

export default async function OrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <AccountShell locale={locale} activeTab="orders">
      <OrdersEmpty locale={locale} />
    </AccountShell>
  );
}
