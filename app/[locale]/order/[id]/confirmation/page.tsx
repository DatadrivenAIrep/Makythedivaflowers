import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ConfirmationView } from "@/components/checkout/ConfirmationView";
import { getOrder } from "@/lib/order-storage";
import type { Locale } from "@/types/locale";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    robots: { index: false, follow: false },
  };
}

export default async function ConfirmationPage({
  params,
}: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-24">
      <ConfirmationView order={order} locale={locale} />
    </main>
  );
}
