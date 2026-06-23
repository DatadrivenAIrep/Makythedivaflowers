import { listGiftCards } from "@/lib/gift-card-storage";
import GiftCardsView from "@/components/admin/gift-cards/GiftCardsView";

export default async function AdminGiftCardsPage({
  params,
}: {
  params: Promise<{ locale: "en" | "es" }>;
}) {
  const { locale } = await params;
  const { cards, stats } = listGiftCards();
  return <GiftCardsView initialCards={cards} initialStats={stats} locale={locale} />;
}
