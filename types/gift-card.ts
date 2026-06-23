export type GiftCardStatus = "active" | "void";

export type GiftCardReason = "loyalty" | "apology" | "prize" | "marketing" | "other";

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
