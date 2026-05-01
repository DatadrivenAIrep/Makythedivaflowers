import { BentoFeaturedTile } from "./BentoFeaturedTile";
import { BentoSubscriptionsTile } from "./BentoSubscriptionsTile";
import { BentoLiveStatusTile } from "./BentoLiveStatusTile";
import { BentoPressTile } from "./BentoPressTile";
import type { Locale } from "@/types/locale";

export function BentoGrid({ locale }: { locale: Locale }) {
  return (
    <section className="max-w-[1400px] mx-auto px-6 py-24 md:py-32">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
        <div className="md:row-span-2">
          <BentoFeaturedTile locale={locale} />
        </div>
        <BentoSubscriptionsTile locale={locale} />
        <BentoLiveStatusTile />
        <div className="md:col-span-2">
          <BentoPressTile />
        </div>
      </div>
    </section>
  );
}
