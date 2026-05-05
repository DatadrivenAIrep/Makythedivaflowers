"use client";
import { useEffect } from "react";
import * as analytics from "@/lib/analytics";
import type { AnalyticsItem } from "@/lib/analytics-types";
import type { PurchasePayload } from "@/lib/analytics";

type ViewItemListProps = {
  kind: "view_item_list";
  itemListName: string;
  items: AnalyticsItem[];
};

type ViewItemProps = {
  kind: "view_item";
  item: AnalyticsItem;
};

type PurchaseProps = {
  kind: "purchase";
  payload: PurchasePayload;
};

type Props = ViewItemListProps | ViewItemProps | PurchaseProps;

export function TrackEvent(props: Props) {
  useEffect(() => {
    if (props.kind === "view_item_list") {
      analytics.trackViewItemList(props.itemListName, props.items);
    } else if (props.kind === "view_item") {
      analytics.trackViewItem(props.item);
    } else if (props.kind === "purchase") {
      analytics.trackPurchase(props.payload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
