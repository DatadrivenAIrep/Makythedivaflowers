"use client";
import { useEffect, useState } from "react";
import type { Occasion } from "@/schemas/card-message";
import { parseCampaign } from "@/lib/campaign-occasion";

/**
 * Reads ?campaign= on the client.
 *
 * Deliberately not `useSearchParams`: on a prerendered route that hook forces
 * everything up to the nearest Suspense boundary to be client-rendered, and the
 * only thing this value does is preselect an occasion inside the card-message
 * assistant — a modal the shopper has to open. Trading the whole product
 * configurator's server render for that would be a bad deal.
 *
 * Reading it in an effect keeps the page fully static and costs nothing: the
 * value is needed on interaction, long after hydration.
 */
export function useCampaignParam(): Occasion | undefined {
  const [campaign, setCampaign] = useState<Occasion | undefined>(undefined);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("campaign");
    setCampaign(parseCampaign(raw ?? undefined));
  }, []);
  return campaign;
}
