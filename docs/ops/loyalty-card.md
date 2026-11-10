# Loyalty card connection

Connects paid web orders to the external loyalty-card program: stamps, reward
redemption and reversal on cancellation. Spec:
`docs/superpowers/specs/2026-11-08-tarjeta-fidelizacion-design.md`.

## Variables

| Variable | Meaning |
| --- | --- |
| `LOYALTY_API_URL` | Base URL of the program API up to `/api/v1`, no trailing slash. |
| `LOYALTY_API_KEY` | Key created in the program for the shop ("Diva web"). |
| `CRON_SECRET` | Already used by the other cron routes; protects the retry route. |

The connection is on only when `LOYALTY_API_URL` and `LOYALTY_API_KEY` are both
set. With either missing, everything behaves as before, including the $15 reward
on the fifth order. When the connection is on, that $15 stops being granted
(codes already issued keep working).

## Cron: every 10 minutes

Steps that fail (program down, timeout) are queued and retried for 72 hours.
After that they are marked failed and Maky is notified once.

```bash
# every 10 minutes
*/10 * * * * curl -fsS -X POST https://makythedivaflowers.com/api/cron/loyalty-sync \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/diva-loyalty-sync.log 2>&1
```

The route answers `{ "done": n, "pending": n, "failed": n }`. With
`DATE_REWARDS_ENABLED` (`docs/ops/date-rewards.md`) the answer gains
`bonus: { done, pending, failed }`, the same counts for the stamps given for
dates and tastes. Without
`CRON_SECRET` it returns 503; with a wrong one, 401. Running it more than once
is safe: every step carries the same order id.

## Go-live steps

1. Confirm with a real key that the production API responds.
2. Load Maky's rewards and leave the welcome stamps at 0.
3. Create a key named "Diva web" and set the variables.
4. Check that Maky's business in the program has United States as its country.
5. Add the new route to the external cron (above).
6. Make a complete test purchase, with a reward and with a cancellation.
