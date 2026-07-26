# Resend transactional delivery runbook

This runbook covers transactional reservation email delivery only.

## Required secrets and variables

Configure these as Cloudflare Worker secrets or production variables:

- `RESEND_API_KEY`: restricted production Resend API key.
- `RESEND_WEBHOOK_SECRET`: signing secret for the production webhook endpoint.
- `CRON_SECRET`: random value of at least 24 characters.
- `EMAIL_FROM`: verified sender, recommended value `Sri U-Thong Reservations <reservations@mail.sriuthong.com>`.
- `EMAIL_REPLY_TO`: monitored hotel reservations mailbox.
- `NEXT_PUBLIC_APP_URL`: canonical HTTPS booking application origin.
- Existing Supabase URL, publishable key, and service-role key.

The production topology uses the single OpenNext Worker defined in
`wrangler.jsonc`. The Resend webhook and notification processor are not
deployed as a separate Worker.

Never expose the Resend API key, webhook secret, cron secret, or Supabase
service-role key to browser code.

## Resend and DNS setup

1. Add `mail.sriuthong.com` as a sending domain in Resend.
2. Add the exact SPF, DKIM, and return-path DNS records shown by Resend. Keep
   Cloudflare proxying disabled for mail DNS records.
3. Add DMARC at `_dmarc.sriuthong.com`, beginning with monitoring policy
   `p=none` and a monitored aggregate-report address.
4. Verify the domain in Resend before setting the production sender.
5. Create a webhook for `https://secure.sriuthonghotels.com/api/resend/webhook`.
6. Subscribe to sent, delivered, delivery delayed, bounced, complained, failed,
   and suppressed email events.
7. Copy the webhook signing secret to `RESEND_WEBHOOK_SECRET`.

Move DMARC to `quarantine`, then `reject`, only after all legitimate hotel
senders have been observed passing alignment.

## Deployment and scheduling

The Cloudflare Worker Cron Trigger in `wrangler.jsonc` runs every minute. Its
scheduled handler invokes the same protected notification route used for manual
operations. Deploy with:

```powershell
npm run deploy:cloudflare

Validate the Worker configuration without uploading with:

```powershell
npm run verify:cloudflare-config
```
```

The deploy command preserves dashboard-managed variables. Confirm the Cron
Trigger is present after deployment and run one manual scheduled-event test.

## Launch verification

1. Apply all Supabase migrations and run database regression tests.
2. Send one reservation-processing and one confirmation message to controlled
   Gmail, Outlook, Yahoo, and Thai-provider mailboxes.
3. Confirm Resend API acceptance, webhook delivery, and database
   `provider_status = delivered`.
4. Inspect message headers for SPF, DKIM, and DMARC pass.
5. Trigger Resend's bounce test address and confirm an active suppression.
6. Confirm subsequent queued mail to the suppressed address is cancelled
   without a provider call.
7. Confirm the staff system-health page alerts on dead letters, adverse provider
   outcomes, stale leases, and active suppressions.

## Incident handling

- Retryable API failures use bounded exponential backoff and provider
  `Retry-After` guidance.
- Permanent request errors are cancelled immediately.
- Permanent bounces, complaints, and provider suppressions block later sends.
- Only an administrator may clear a suppression, with an audit reason.
- Managers and administrators may requeue dead letters with an audit reason.
  Recovery creates a fresh Resend idempotency identity because Resend retains
  idempotency keys for only 24 hours.
- Treat a rising adverse-outcome count or any dead letter as an operational
  incident. Check domain verification, quota, provider status, and recipient
  quality before replaying.
