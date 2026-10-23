import "server-only";
import { getAccount, accountBalanceCents, listContacts } from "@/lib/house-account-storage";
import { listEntries } from "@/lib/house-account-ledger";
import { listStatements } from "@/lib/house-account-statements";
import { listForAccount } from "@/lib/house-account-sends";
import { dueCents } from "@/lib/house-account-settlement";
import type { Customer } from "@/lib/customer-storage";
import type { HouseAccount, LedgerEntry, Statement, ScheduledSend } from "@/types/house-account";

export type StatementView = Statement & { dueCents: number };
export type LedgerView = LedgerEntry & { runningCents: number };
export type AccountDetailData = {
  account: HouseAccount;
  balanceCents: number;
  statements: StatementView[];
  entries: LedgerView[];
  contacts: Customer[];
  sends: ScheduledSend[];
};

export function getAccountDetail(id: string): AccountDetailData | null {
  const account = getAccount(id);
  if (!account) return null;
  let running = 0;
  const entries = listEntries(id).map((e) => { running += e.amountCents; return { ...e, runningCents: running }; });
  return {
    account,
    balanceCents: accountBalanceCents(id),
    statements: listStatements(id).map((s) => ({ ...s, dueCents: dueCents(s) })),
    entries,
    contacts: listContacts(id),
    sends: listForAccount(id),
  };
}
