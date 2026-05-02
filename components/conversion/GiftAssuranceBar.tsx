import { useTranslations } from "next-intl";
import { Leaf, ArrowsCounterClockwise, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { Locale } from "@/types/locale";
import { cn } from "@/lib/cn";
import { CONV_EVENTS } from "@/lib/conversion/events";

type Size = "sm" | "md";
type Surface = "pdp" | "cart" | "checkout";

type Props = {
  size?: Size;
  surface: Surface;
  locale: Locale;
};

export function GiftAssuranceBar({ size = "md", surface, locale: _locale }: Props) {
  const t = useTranslations("conversion.assurance");
  const showBody = size !== "sm";
  const items = [
    { Icon: Leaf, titleKey: "hand_built_title", bodyKey: "hand_built_body" },
    { Icon: ArrowsCounterClockwise, titleKey: "redo_title", bodyKey: "redo_body" },
    { Icon: MapPin, titleKey: "local_title", bodyKey: "local_body" },
  ] as const;

  return (
    <ul
      role="list"
      data-conv-event={CONV_EVENTS.assurance.view}
      data-surface={surface}
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-3",
        size === "sm" && "gap-2 md:gap-4",
      )}
    >
      {items.map(({ Icon, titleKey, bodyKey }) => (
        <li
          key={titleKey}
          className={cn(
            "flex items-start gap-3",
            size === "md" && "md:flex-col md:items-start md:text-left",
          )}
        >
          <Icon
            aria-hidden
            size={size === "sm" ? 16 : 20}
            className="text-rouge shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p
              className={cn(
                "font-display tracking-tight text-ink",
                size === "sm" ? "text-sm leading-snug" : "text-base leading-tight",
              )}
            >
              {t(titleKey)}
            </p>
            {showBody && (
              <p className="mt-1 text-sm text-ink/70 leading-snug">{t(bodyKey)}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
