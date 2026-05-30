import RunSheetView from "@/components/admin/dashboard/RunSheetView";

export const dynamic = "force-dynamic";

export default async function RunSheetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RunSheetView locale={locale} />;
}
