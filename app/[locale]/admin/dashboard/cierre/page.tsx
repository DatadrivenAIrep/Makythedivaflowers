import CashCloseView from "@/components/admin/dashboard/CashCloseView";

export const dynamic = "force-dynamic";

export default async function CashClosePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <CashCloseView locale={locale} />;
}
