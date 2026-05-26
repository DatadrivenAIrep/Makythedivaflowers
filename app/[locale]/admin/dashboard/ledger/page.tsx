import LedgerView from "@/components/admin/dashboard/LedgerView";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LedgerView locale={locale} />;
}
