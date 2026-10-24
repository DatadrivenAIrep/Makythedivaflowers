import { getTranslations } from "next-intl/server";
import { ArrowsCounterClockwise, Star, Storefront, Truck } from "@phosphor-icons/react/dist/ssr";
import { REVIEWS_AGGREGATE } from "@/data/reviews";
import { CONV_EVENTS } from "@/lib/conversion/events";

/**
 * The four things a first-time visitor checks before scrolling on — the Google
 * rating, same-day delivery, the free redo and the real shop — in one quiet
 * band right under the hero, where the decorative marquee used to run. The
 * rating jumps down to the reviews further down the page.
 */
export async function AssuranceStrip() {
  const t = await getTranslations("home.assurance");
  const items = [
    {
      key: "rating",
      Icon: Star,
      label: t("rating", { rating: String(REVIEWS_AGGREGATE.rating), count: REVIEWS_AGGREGATE.total }),
      href: "#reviews",
    },
    { key: "same_day", Icon: Truck, label: t("same_day") },
    { key: "redo", Icon: ArrowsCounterClockwise, label: t("redo") },
    { key: "local", Icon: Storefront, label: t("local") },
  ];

  return (
    <section aria-label={t("aria")} className="border-b border-ink/10">
      <ul
        role="list"
        data-conv-event={CONV_EVENTS.assurance.view}
        data-surface="home"
        className="mx-auto grid max-w-[var(--container-max)] grid-cols-2 gap-x-5 gap-y-4 px-6 py-5 md:grid-cols-4 md:gap-8 md:py-6"
      >
        {items.map(({ key, Icon, label, href }) => (
          <li key={key} className="flex items-start gap-2.5 md:items-center">
            <Icon
              aria-hidden
              size={18}
              weight={key === "rating" ? "fill" : "regular"}
              className="mt-0.5 shrink-0 text-rouge md:mt-0"
            />
            {href ? (
              <a
                href={href}
                className="font-display text-[15px] leading-snug tracking-tight text-ink underline-offset-4 hover:underline md:text-base"
              >
                {label}
              </a>
            ) : (
              <span className="font-display text-[15px] leading-snug tracking-tight text-ink md:text-base">
                {label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
