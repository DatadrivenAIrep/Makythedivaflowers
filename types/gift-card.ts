export type GiftCardStatus = "active" | "void";

// "purchase" = bought by a customer on the site, "referral" = credit earned by
// introducing someone; the rest are staff-issued.
export type GiftCardReason =
  | "loyalty"
  | "apology"
  | "prize"
  | "marketing"
  | "other"
  | "purchase"
  | "referral";

export type GiftCard = {
  id: string;
  code: string;
  initialCents: number;
  balanceCents: number;
  status: GiftCardStatus;
  recipientEmail: string;
  recipientName?: string;
  fromLabel?: string;
  personalMessage?: string;
  reason?: GiftCardReason;
  issuedBy?: string;
  /** Set when a customer bought the card on the site rather than staff issuing it. */
  purchasePaymentIntentId?: string;
  purchaserEmail?: string;
  expiresAt?: string; // ISO
  createdAt: string;
  updatedAt: string;
};

export type GiftCardRedemption = {
  id: string;
  giftCardId: string;
  orderId?: string;
  amountCents: number; // + redeem, - refund
  type: "redeem" | "refund";
  createdAt: string;
};

/** Derived label for the admin list. */
export type GiftCardDisplayStatus =
  | "active"
  | "partial"
  | "empty"
  | "expired"
  | "void";

/** Safe shape returned to the (untrusted) checkout client — never internal notes/recipient. */
export type GiftCardPublic = {
  code: string;
  balanceCents: number;
  expiresAt?: string;
};
