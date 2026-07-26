# Next.js Integration Contract

This document defines the non-negotiable application behavior around the Hotel Inventory Bridge database migrations.

## Priority 0 — Launch blockers

### Checkout hold requests

- Run hold creation in a server-only Next.js route or Server Action; never expose the Supabase service-role key.
- Invoke `create_checkout_hold_with_context` so inventory allocation, payment-mode selection, and required consent capture commit atomically. Do not recreate this as three independent API calls.
- Migration `018` allows reservation guest fields to become `NULL` only for lawful PII scrubbing. Before invoking `create_checkout_hold_with_context`, the server tier must use `checkoutHoldRequestSchema` to require a non-blank guest name, valid guest email, valid guest phone, valid cart, and current policy versions. Browser `required` attributes are only a usability aid.
- Generate and persist a high-entropy idempotency key before sending the first hold request. Reuse it for network retries of the unchanged cart, but immediately generate and persist a new key if the user changes any cart parameter, including stay dates, room type, room count, guest count, occupancy, rate plan, or promo code.
- Strict Timezone Normalization: All `check_in` and `check_out` date strings sent to the backend must be calculated, validated, and formatted relative to the property's local timezone (`Asia/Bangkok`). Never transmit raw guest-browser dates or Edge Runtime UTC defaults.
- Rate Limiting: Protect the checkout-hold API route with strict IP-based rate limiting before production launch—for example, no more than five hold requests per IP address per hour—to prevent automated inventory-exhaustion attacks. Apply bot protection and operational monitoring without exposing whether inventory was held.
- Configure a deployment-supported maximum duration of at least 30 seconds for hold routes. Do not use an unbounded timeout.
- If the HTTP request times out, show a “checking your reservation” state and retry with the same idempotency key. Never create a second cart key automatically.
- Treat database results as authoritative. A browser-side availability result never proves that a hold exists.
- Record contention and duration metrics by room type. Review the advisory-lock design if normal p95 hold latency exceeds two seconds; safety takes priority over speculative sub-500 ms behavior during an artificial 50-request burst.

### Stripe webhook behavior

- Verify the Stripe signature against the raw request body before calling any database function.
- Call `finalize_paid_checkout_hold` only from the server with service-role credentials.
- Return HTTP 200 when finalization returns `ok: true`, including `idempotent: true`. Duplicate Stripe delivery is a normal success path.
- Treat `PAYMENT_IDEMPOTENCY_CONFLICT`, `PAYMENT_ALREADY_USED`, `STRIPE_SESSION_MISMATCH`, expired holds, and amount mismatches as terminal manual-review cases. Queue a high-priority operations alert, record the Stripe event ID, and return HTTP 200 only after that durable record succeeds; retries cannot repair these conflicts.
- Return a non-2xx response for transient database, network, or unavailable-service errors so Stripe retries later.
- Never send a second guest confirmation from the webhook handler. The transactional outbox owns notification delivery.

### Payment modes and pay-at-hotel behavior

- Existing callers remain Stripe by default. Continue calling `finalize_paid_checkout_hold` only after raw-body Stripe signature verification.
- Persist the guest-selected mode on the active hold with `set_checkout_hold_payment_mode` before starting either finalization path.
- Call `finalize_pay_at_hotel_checkout_hold` only from a server-only route with service-role credentials. It must never be exposed directly to the browser.
- A pay-at-hotel reservation has no Stripe session or payment-intent ID, starts with `payment_status = 'not_collected'`, `total_paid = 0`, and `amount_due` equal to the authoritative hold total.
- Treat `sync_status` as PMS-confirmation state and `payment_status` as collection state. Marking a reservation entered in the PMS must not imply that pay-at-hotel funds were collected.
- Record collection through `mark_pay_at_hotel_payment_collected`; require the exact outstanding amount and preserve its payment audit event.
- Display payment mode and payment status on reservation queues and detail views. Guest and staff notifications must state whether payment was collected online or remains due at the hotel.
- Treat `PAYMENT_MODE_MISMATCH` as a terminal server-side integration error. Never silently move a hold between Stripe and pay-at-hotel after finalization starts.

### Payment-mode migration rollout

- Migration `012_pay_at_hotel_bookings.sql` must not rewrite historical notification or reservation rows during schema deployment.
- After deploy, run `supabase/maintenance/012_backfill_notification_payment_context.sql` as a throttled background task until both returned counts are zero. Each call is bounded to 250 rows and uses `FOR UPDATE SKIP LOCKED`.
- Then run `supabase/maintenance/012_finalize_payment_mode_maintenance.sql` once, outside a transaction and during a low-traffic window, to validate historical constraints and build the payment-status index concurrently.
- Keep the Stripe PostgREST call mapped to `finalize_paid_checkout_hold` with the exact existing parameter names. The trailing `p_stripe_payment_intent_id` remains optional with a SQL default of `null`.
- Both finalizers must be `SECURITY DEFINER`, explicitly granted to `service_role`, and unavailable to `anon` and `authenticated`.

### Guest booking lookup

- The public `/lookup` page must use reference ID + guest email verification only. Do not create guest accounts for status lookup.
- Call `lookup_guest_reservation` only from a server-side route with service-role credentials.
- Validate lookup inputs before calling Supabase. Reject malformed email and reference values with guest-safe wording.
- Return only the masked booking-status payload: public status, room category, stay dates, payment summary, and hotel contact details.
- Never return internal notes, room numbers, staff audit events, raw payment logs, Stripe identifiers, or full guest PII.
- Set `Cache-Control: no-store` on lookup responses.
- On the Cloudflare Free plan, protect `/api/booking-lookup` with app-side throttling and masked responses, and reserve the single Cloudflare WAF rate-limit rule for `POST /api/checkout/hold`.
- If pilot reservations predate migration `017`, run `backfill_booking_reference_ids_batch` until it returns `0`.
- Lookup hotel contact details must come from `hotel_settings.public_contact_phone` and `hotel_settings.public_contact_address`, never from a hardcoded global hotel constant.
- Every lookup miss, including a booking made inaccessible after lawful PII scrubbing, must use the same privacy-preserving response: "Booking not found. Please check the reference and email. Details for stays older than 7 years are automatically archived in compliance with Thailand's PDPA privacy requirements. If you still need help, please contact the hotel."
- Old bookings whose direct PII has been scrubbed by retention should no longer be lookup-accessible by email; show the normal generic “not found” message.

### Notification delivery worker

- Atomically claim notification rows with `FOR UPDATE SKIP LOCKED`, transition them to `processing`, increment `attempts`, and assign a unique lease token tied to that attempt.
- Require the event ID, lease token, and attempt number when completing or failing a delivery. A stale worker must not be able to modify a newer claim.
- Include the deterministic `provider_message_id` derived from `notification_events.id` in every provider request as the provider-supported idempotency key.
- Run a service-role-only worker on a short schedule. Protect any HTTP trigger with a dedicated cron secret.
- Dispatch email through the configured Resend or SendGrid provider and webhook/SMS through the configured management endpoint.
- Mark successful rows `sent` with `sent_at`. Mark failures `failed`, save a sanitized error, and calculate bounded exponential backoff through `next_attempt_at`.
- Recover rows left in `processing` beyond the hotel-configured lease period, defaulting to ten minutes, so a crashed worker cannot strand messages.
- Do not write guest contact details, provider credentials, or full notification payloads to application logs.
- `run_hotel_retention_jobs()` must prune completed/terminal notification events according to `audit_retention_months` so payload JSON and recipients do not retain PII indefinitely.

## Priority 1 — Guest and staff experience

### Tetris error mapping

- Map `TETRIS_PLAN_NOT_FOUND` to: “We have limited availability for these dates, but cannot keep the same room available for your entire stay. Please try different dates, another room type, or contact the hotel.”
- Map `INSUFFICIENT_INVENTORY` to a normal sold-out state.
- Map `INVENTORY_COVERAGE_INCOMPLETE` to a neutral temporary-unavailability message and raise an internal staff alert.
- Never display PostgreSQL error codes, hints, room numbers, or shuffle details to guests.
- Preserve the guest’s dates and occupancy when offering alternatives.

### System Health dashboard

- Show `system_health_summary` to managers, including the stale-worker indicator and failures from the last 24 hours.
- Show `recent_failed_background_jobs`, limited to five entries by the database view.
- Display a prominent warning when the five-minute operational worker has not completed within 15 minutes.
- Paginate longer operational and audit histories with cursor-based queries; never load the full tables into the browser.

## pg_cron launch verification

Migration `018_privacy_lookup_hardening.sql` is the authoritative source for `run_hotel_retention_jobs()`. Migration `014` is historical migration order only. Add a new forward migration for future retention changes and replace the complete migration `018` worker definition there.

- Confirm `pg_cron` is enabled in the Supabase Dashboard before production launch.
- Confirm both jobs exist: `hotel-bridge-operational-jobs` and `hotel-bridge-retention-jobs`.
- Run `run_hotel_operational_jobs()` manually and verify a completed row appears in `background_job_runs`.
- Configure an external scheduled fallback when the hosting tier does not support `pg_cron`.
- A cron outage does not permanently make inventory look sold out: searches ignore expired timestamps and checkout creation performs cleanup. It does delay proactive cleanup, staff reminders, SLA escalation, and retention work, so the System Health warning remains launch-critical.

## Required tests

- Concurrent retries with one idempotency key produce one hold.
- A client timeout followed by retry resolves to the original hold.
- Changing any cart parameter invalidates the previous idempotency key and the next request uses a newly generated key.
- A browser outside Thailand and an Edge Runtime executing in UTC both submit the intended `Asia/Bangkok` hotel dates.
- The checkout-hold rate limit rejects excess requests without creating additional holds or leaking inventory state.
- Duplicate Stripe events return 200 and produce one reservation and one notification event.
- Transient webhook failures return non-2xx and succeed on retry.
- Two notification workers cannot claim the same event.
- Failed notification delivery retries with backoff and eventually recovers from a stale processing lease.
- Every named Tetris and inventory error renders its approved guest-facing message.
- Disabling the scheduler creates a stale System Health warning within 15 minutes.
- Existing Stripe hold finalization still creates one collected reservation with Stripe identifiers and zero amount due.
- Pay-at-hotel finalization creates one idempotent reservation without Stripe identifiers, with payment outstanding and PMS status Pending.
- A Stripe finalizer cannot convert a pay-at-hotel hold, and payment collection does not mutate PMS synchronization state.
- Notification and audit records include payment mode, payment status, amount paid, and amount due for both flows.
