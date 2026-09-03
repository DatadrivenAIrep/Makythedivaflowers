// app/[locale]/account/orders/page.tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { OrdersEmpty } from "@/components/account/OrdersEmpty";
import { OrderHistory } from "@/components/account/OrderHistory";
import { verifyCustomerSession, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth";
import { listOrdersByCustomer } from "@/lib/order-storage";
import type { Locale } from "@/types/locale";
import { localeAlternates } from "@/lib/seo/alternates";

// Renders one customer's order history: never prerendered, never cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Mis pedidos — Diva Flowers" : "My Orders — Diva Flowers",
    alternates: localeAlternates(locale, "/account/orders"),
    robots: { index: false },
  };
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const customerId = verifyCustomerSession(
    (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value ?? "",
  );
  if (!customerId) redirect(`/${locale}/account`);

  const orders = listOrdersByCustomer(customerId);

  return (
    <AccountShell locale={locale} activeTab="orders">
      {orders.length === 0 ? (
        <OrdersEmpty locale={locale} />
      ) : (
        <OrderHistory orders={orders} locale={locale} />
      )}
    </AccountShell>
  );
}
