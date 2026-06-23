import { listGiftCards } from "@/lib/gift-card-storage";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import GiftCardsView from "@/components/admin/gift-cards/GiftCardsView";

export default async function AdminGiftCardsPage({
  params,
}: {
  params: Promise<{ locale: "en" | "es" }>;
}) {
  const { locale } = await params;
  const { cards, stats } = listGiftCards();
  return (
    <DashboardShell locale={locale}>
      <GiftCardsView initialCards={cards} initialStats={stats} locale={locale} />
    </DashboardShell>
  );
}
