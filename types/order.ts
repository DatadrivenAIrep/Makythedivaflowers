import type { Address } from "@/types/address";
import type { CartLine } from "@/lib/cart-store";

export type DeliverySlot = "morning" | "midday" | "afternoon" | "evening";

export type DeliveryWindow = {
  date: string; // YYYY-MM-DD
  slot: DeliverySlot;
};

export type Recipient = {
  name: string;
  phone: string;
};

export type OrderTotals = {
  subtotalCents: number;
  deliveryCents: number;
  taxCents: number;
  totalCents: number;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "out-for-delivery"
  | "delivered"
  | "failed";

export type Order = {
  id: string;
  locale: "en" | "es";
  lines: CartLine[];
  delivery: {
    recipient: Recipient;
    address: Address;
    window: DeliveryWindow;
    cardMessage?: string;
  };
  contact: {
    email: string;
    phone: string;
  };
  totals: OrderTotals;
  stripePaymentIntentId?: string;
  status: OrderStatus;
  createdAt: string; // ISO
};
