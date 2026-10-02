export type AccountCadence = "weekly" | "biweekly" | "monthly";
export type SendChannel = "sms" | "email" | "both";
export type AccountStatus = "active" | "paused" | "closed";
export type ReminderStep = { offsetDays: number; channel: SendChannel };

export type HouseAccount = {
  id: string;
  name: string;
  billingName?: string;
  billingPhone?: string; // digits only
  billingEmail?: string;
  locale: "en" | "es";
  cadence: AccountCadence;
  issueDay: number;       // monthly: 1..28; weekly/biweekly: weekday 0..6 (Sunday = 0)
  anchorDate?: string;    // biweekly only, YYYY-MM-DD
  termsDays: number;
  reminderPlan: ReminderStep[];
  statementChannel: SendChannel;
  status: AccountStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type EntryKind = "charge" | "payment" | "credit" | "adjustment" | "reversal";
export type AccountPaymentMethod = "cash" | "zelle" | "ach" | "check" | "card-terminal" | "stripe";

export type LedgerEntry = {
  id: string;
  accountId: string;
  kind: EntryKind;
  amountCents: number; // signed
  orderId?: string;
  statementId?: string;
  method?: AccountPaymentMethod;
  stripeSessionId?: string;
  note?: string;
  actor: string;
  createdAt: string;
};

export type StatementStatus = "open" | "paid" | "void";
export type StatementLine = {
  date: string; // YYYY-MM-DD shop time
  kind: EntryKind;
  label: string;
  orderId?: string;
  orderNumber?: number;
  amountCents: number; // signed
};
export type Statement = {
  id: string;
  accountId: string;
  number: string;
  code: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueDate: string;
  openingCents: number;
  chargesCents: number;
  creditsCents: number;
  paymentsCents: number;
  closingCents: number;
  settledCents: number;
  status: StatementStatus;
  lines: StatementLine[];
  createdAt: string;
};

export type SendKind = "statement" | "reminder" | "manual";
export type SendStatus = "scheduled" | "sending" | "sent" | "skipped" | "failed" | "canceled";
export type ScheduledSend = {
  id: string;
  accountId: string;
  statementId: string;
  kind: SendKind;
  stepIndex?: number;
  channel: SendChannel;
  scheduledFor: string;
  status: SendStatus;
  claimedAt?: string;
  sentAt?: string;
  smsSid?: string;
  emailId?: string;
  body?: string;
  error?: string;
  createdAt: string;
};
