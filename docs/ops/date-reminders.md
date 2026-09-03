# Important-date reminders

Sends one SMS per saved customer date, seven days before it comes round:
"se acerca un cumpleaños el 9 de septiembre. ¿Te lo preparamos?"

The dates come from the CRM (`/admin/customers` → a customer's important dates).
Only customers tagged `sms-marketing` and not set to `messaging_channel = 'none'`
are messaged.

## Wiring the cron

The app has no internal scheduler on purpose: it runs as a single Node process
that restarts on every deploy, so a `setInterval` would stop silently. Drive it
from outside instead.

1. Set `CRON_SECRET` in the server environment to a long random string. Without
   it the route refuses to run and returns 503 — it never runs unauthenticated.
2. Add a daily cron on the host (Hostinger's panel, or `crontab -e`). Once a
   day, mid-morning New York time, is right: the message should not arrive at
   3 AM.

```bash
# 09:15 America/New_York, every day
15 9 * * * curl -fsS -X POST https://makythedivaflowers.com/api/cron/reminders \
  -H "Authorization: Bearer $CRON_SECRET" >> /var/log/diva-reminders.log 2>&1
```

## Safety properties

- **Runs twice, sends once.** Each send is recorded in `date_reminder_sends`
  keyed by date and occurrence, so a retry, a second host, or a manual run
  cannot text the same person twice about the same birthday.
- **Next year still fires**, because the occurrence date is part of the key.
- **A dry run still records.** If Twilio is off or in dry-run mode the route
  reports what it would have sent and marks it done. That is deliberate: leaving
  everything "due" would text the entire list at once the moment SMS is enabled.
  To do a real dry run without consuming the sends, point the job at a copy of
  the database.
- **One bad number does not stop the batch.**

## Checking it ran

```bash
curl -fsS -X POST http://localhost:3000/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"
# {"due":3,"sent":3,"failed":0,"dryRun":true}
```

Server logs carry a `date_reminders_run` line with the same counts.
