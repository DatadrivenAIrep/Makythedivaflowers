import DashboardShell from "@/components/admin/dashboard/DashboardShell";
import OccasionsView from "@/components/admin/occasions/OccasionsView";
import CardDatesPanel from "@/components/admin/occasions/CardDatesPanel";
import DateResults from "@/components/admin/occasions/DateResults";
import { dateResults } from "@/lib/date-results";
import { dateRewardsEnabled } from "@/lib/date-rewards-flags";
import { listCardReviews, previewCardScan, type CardReview, type CardScanPreview } from "@/lib/card-dates-scan";
import { errorClass } from "@/lib/card-dates-log";
import { listUpcomingOccasions } from "@/lib/customer-dates-storage";

export const dynamic = "force-dynamic";

export default async function AdminOccasionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const initial = listUpcomingOccasions(30);
  const results = dateRewardsEnabled() ? dateResults() : null;
  // The card panel is an extra: if reading it fails, hide it and keep the page.
  let card: { preview: CardScanPreview; reviews: CardReview[] } | null = null;
  try {
    card = { preview: previewCardScan(), reviews: listCardReviews() };
  } catch (e) {
    console.error(JSON.stringify({ event: "card_dates_page_failed", error: errorClass(e) }));
  }
  return (
    <DashboardShell locale={locale}>
      {results && <DateResults results={results} />}
      {card && <CardDatesPanel initialPreview={card.preview} initialReviews={card.reviews} locale={locale} />}
      <OccasionsView locale={locale} initial={initial} />
    </DashboardShell>
  );
}
