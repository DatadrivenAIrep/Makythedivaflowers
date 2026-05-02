"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Locale } from "@/types/locale";
import type { SubscriptionPlanId } from "@/data/subscription-plans";
import { SubscriptionTiers } from "@/components/subscription/SubscriptionTiers";
import { SubscriptionInquiryForm } from "@/components/subscription/SubscriptionInquiryForm";

type Props = {
  locale: Locale;
  initialPlan: SubscriptionPlanId;
  hero: ReactNode;
  howItWorks: ReactNode;
};

export function SubscriptionLanding({ locale, initialPlan, hero, howItWorks }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(initialPlan);

  function handleSelect(id: SubscriptionPlanId) {
    setSelectedPlan(id);
    document.getElementById("inquire")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {hero}
      <SubscriptionTiers locale={locale} selected={selectedPlan} onSelect={handleSelect} />
      {howItWorks}
      <SubscriptionInquiryForm locale={locale} plan={selectedPlan} />
    </>
  );
}
