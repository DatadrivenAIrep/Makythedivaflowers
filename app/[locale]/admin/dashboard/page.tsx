import BandejaView from "@/components/admin/dashboard/BandejaView";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <BandejaView locale={locale} />;
}
