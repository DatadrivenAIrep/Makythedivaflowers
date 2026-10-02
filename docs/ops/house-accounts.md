# House accounts (cuentas por cobrar)

Organizations with a house account order through the admin intake with the
"A cuenta" payment option. Nothing is charged at order time; the daily job
closes each account's period on its issue day, freezes a statement, and
queues the statement text and its reminders. Staff see the queue at
`/admin/accounts` and can send, skip or reschedule anything by hand.

The customer gets a short link (`https://makythedivaflowers.com/s/<code>`)
that shows the statement, prints to PDF, and pays by card through Stripe
Checkout. Zelle, cash, ACH and check payments are recorded on the account's
page ("Registrar pago"); payments are applied oldest-first to the orders on
the account so the ledger, Bandeja and metrics agree.

## Reembolsos

An account order's money lives on the account, so "Cancelar + reembolso" is
refused for it (409 `on_account`); cancel it without refund (the charge is
reversed and anything already applied stays as credit). If money actually
goes back to the customer, record it on the account: a cash (or Zelle, check)
refund is a positive **Ajuste** with the note "Reembolso", which takes the
credit back out of the balance. Card refunds are issued in Stripe and then
recorded the same way.

## Wiring the cron

Same pattern as `docs/ops/date-reminders.md`, same `CRON_SECRET`:

```bash
# 09:20 America/New_York, every day (after the date reminders at 09:15)
20 9 * * * curl -fsS -X POST https://makythedivaflowers.com/api/cron/house-accounts \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/diva-house-accounts.log 2>&1
```

## Safety properties

- **Issue once per period.** A live statement per `(account, period_end)` is
  enforced by the database; a second run the same day issues nothing.
- **Send once.** Every queued message is claimed (`scheduled → sending`)
  before it goes out. A second run, a retry or a manual "Enviar ya" cannot
  text the same row twice. A crash mid-send is turned into a failed row an
  hour later and shows in the queue with "interrumpido".
- **Dry run still records.** With Twilio off or in dry-run the row is marked
  sent with `dry-run` as the sid, exactly like the date reminders.
- **Paused accounts freeze.** Nothing goes out while an account is paused;
  on reactivation, anything that fell due meanwhile is marked skipped, never
  sent in a burst.
- **Opt-out respected.** A billing phone that replied STOP gets no SMS; the
  email still goes if the account has one, and the queue row says why.
- **Stripe is idempotent.** The webhook records a statement payment once per
  Checkout session (`UNIQUE stripe_session_id`).

## Checking it ran

```bash
curl -fsS -X POST http://localhost:3000/api/cron/house-accounts -H "Authorization: Bearer $CRON_SECRET"
# {"ok":true,"today":"2026-10-01","issued":2,"sent":2,"skipped":0,"failed":0}
```

Server logs carry a `house_accounts_run` line with the same counts.

## Defaults

New accounts start monthly on the 1st, 15-day terms, reminders at −3, 0 and
+7 days (SMS, SMS, SMS + email), statement by SMS + email. To change the
defaults for new accounts, insert a `settings` row with key
`house_account_defaults` and a JSON value of the same shape (see
`lib/house-account-plan.ts`). Existing accounts keep their own plan.
