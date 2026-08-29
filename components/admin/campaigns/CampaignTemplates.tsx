"use client";
import { useTranslations } from "next-intl";
import type { Icon } from "@phosphor-icons/react";
import {
  Heart,
  FlowerLotus,
  Flower,
  FlowerTulip,
  Cake,
  Confetti,
  Gift,
  Sun,
  Leaf,
  Sparkle,
  Truck,
  Tag,
  HandHeart,
  GraduationCap,
  Snowflake,
  ClockCountdown,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import {
  CAMPAIGN_TEMPLATES,
  CAMPAIGN_TEMPLATE_CATEGORIES,
  type CampaignTemplate,
} from "@/data/campaign-templates";

const ICONS: Record<string, Icon> = {
  Heart,
  FlowerLotus,
  Flower,
  FlowerTulip,
  Cake,
  Confetti,
  Gift,
  Sun,
  Leaf,
  Sparkle,
  Truck,
  Tag,
  HandHeart,
  GraduationCap,
  Snowflake,
  ClockCountdown,
  Star,
};

export default function CampaignTemplates({
  locale,
  onPick,
}: {
  locale: string;
  onPick: (template: CampaignTemplate) => void;
}) {
  const t = useTranslations("admin_campaigns");
  const lang: "es" | "en" = locale === "en" ? "en" : "es";
  if (CAMPAIGN_TEMPLATES.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink/50">{t("templates_hint")}</p>
      {CAMPAIGN_TEMPLATE_CATEGORIES.map((cat) => {
        const items = CAMPAIGN_TEMPLATES.filter((tpl) => tpl.category === cat.key);
        if (items.length === 0) return null;
        return (
          <div key={cat.key}>
            <div className="mb-1.5 text-xs uppercase tracking-wide text-ink/40">{cat.label[lang]}</div>
            <div className="flex flex-wrap gap-2">
              {items.map((tpl) => {
                const IconCmp = ICONS[tpl.icon] ?? Flower;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onPick(tpl)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-bone px-3 text-sm text-ink/80 transition-colors hover:border-rouge/40 hover:bg-rouge/5 hover:text-ink"
                  >
                    <IconCmp size={15} weight="duotone" className="text-rouge" aria-hidden />
                    {tpl.label[lang]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
