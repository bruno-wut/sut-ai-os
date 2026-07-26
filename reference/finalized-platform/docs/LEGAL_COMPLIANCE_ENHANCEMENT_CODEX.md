# Codex Task: Implement Legal, Compliance, Security & Booking Architecture Enhancements

## Role

You are acting as a **senior full-stack engineer** working on an existing hotel website / booking platform codebase.

Your job is to inspect the existing repository, understand the current architecture, and implement the compliance/security/booking enhancements described below.

Do **not** rewrite the whole system unless absolutely necessary.

Prioritize safe, incremental changes that fit the existing codebase.

---

# Project Context

This project is a hotel platform in Thailand.

The system may include:

* Static marketing website
* Internet Booking Engine / IBE
* Staff dashboard
* Supabase PostgreSQL database
* Supabase Auth
* Payment gateway integration
* Manual PMS sync workflow
* Booking management
* Customer data handling
* Staff/admin access

The target architecture is:

* Static storefront: low-risk, no sensitive data
* IBE: handles booking flow, customer PII, consent, and checkout holds
* Staff dashboard: protected admin portal for bookings, PMS sync, and customer operations
* Supabase PostgreSQL: system of record with RLS, RBAC, audit logs, and atomic booking holds
* Payment gateway: Opn/Stripe/etc. handles PCI-sensitive payment processing
* Backend/API: validates webhooks and never trusts client-side pricing

---

# Main Objective

Enhance the existing codebase so that the hotel platform better satisfies:

1. Thai PDPA compliance
2. Booking contract traceability
3. Payment security
4. Staff dashboard access control
5. Audit logging
6. Data retention
7. Double-booking prevention
8. Manual PMS sync workflow
9. Long-term maintainability

---

# Important Working Rules

Before making changes:

1. Inspect the current repository structure.
2. Identify existing frontend, backend, database, Supabase, auth, booking, payment, and dashboard files.
3. Reuse existing patterns where possible.
4. Do not duplicate existing systems if similar functionality already exists.
5. Do not hardcode secrets.
6. Do not expose service role keys to the client.
7. Do not trust client-side price, room rate, total amount, or payment status.
8. Use server-side validation for sensitive workflows.
9. Keep changes atomic and understandable.
10. Add comments only where useful.

If important information is missing, ask me clearly before implementing risky assumptions.

---

# Required Output From You

After implementation, provide a clear summary containing:

## 1. Files Changed

List every file you modified or created.

## 2. Implementations Added

Summarize what you added, grouped by feature.

## 3. Security Improvements

Explain what security risks were reduced.

## 4. Compliance Improvements

Explain what legal/compliance requirements are better supported.

## 5. Remaining Manual Setup

List anything I must configure manually, such as:

* Supabase environment variables
* Payment gateway webhook secrets
* Cron jobs
* RLS policies
* Database migrations
* Cloudflare settings
* Staff roles

## 6. Questions / Missing Information

If anything is unclear or blocked, list questions for me.

---

# Phase 1 — Repository Audit

First, inspect the codebase and identify:

* Framework used for storefront
* Framework used for IBE
* Framework used for staff dashboard
* Existing Supabase client setup
* Existing Supabase server/admin setup
* Existing auth middleware
* Existing booking flow
* Existing payment flow
* Existing database migrations
* Existing RLS policies
* Existing staff dashboard routes
* Existing customer data models
* Existing audit/logging code
* Existing cron/retention jobs

Then decide the safest implementation path.

Do not skip this phase.

---

# Phase 2 — PDPA Consent & Terms Versioning

## Goal

Every booking must record exactly which legal documents the customer accepted.

## Implement

Add or verify support for storing:

* `terms_version`
* `privacy_policy_version`
* `cancellation_policy_version`
* `marketing_consent`
* `pdpa_consent`
* `consent_timestamp`
* `consent_ip_address`, if available server-side
* `consent_user_agent`, if available server-side

## Requirements

In the IBE checkout flow:

* Consent checkbox must not be pre-ticked.
* Customer must explicitly accept booking terms and privacy policy before payment/confirmation.
* Marketing consent must be separate from required booking consent.
* Store consent data with the checkout hold and/or final reservation.
* Legal version values should be configurable constants, not scattered strings.

## Suggested Implementation

Create or update a file similar to:

* `lib/legal/legalVersions.ts`
* `lib/legal/consent.ts`
* `src/lib/legal/legalVersions.ts`

Example constants:

```ts
export const LEGAL_VERSIONS = {
  terms: "2026-06-01",
  privacyPolicy: "2026-06-01",
  cancellationPolicy: "2026-06-01",
} as const;
```

Use existing project structure if different.

---

# Phase 3 — Atomic Checkout Holds

## Goal

Prevent double bookings and create a legally traceable booking contract state before payment.

## Implement

Add or verify a `checkout_holds` system.

A checkout hold should include:

* `id`
* `hold_token`
* `room_type_id` or equivalent
* `check_in`
* `check_out`
* `guest_count`
* `customer_name`
* `customer_email`
* `customer_phone`
* `quoted_amount`
* `currency`
* `status`
* `expires_at`
* `terms_version`
* `privacy_policy_version`
* `cancellation_policy_version`
* `pdpa_consent`
* `marketing_consent`
* `created_at`
* `updated_at`

## Security Requirements

* `hold_token` must be high entropy.
* The client must not be able to create arbitrary confirmed bookings.
* The server/database must verify availability.
* The server/database must calculate or verify price.
* The hold must expire automatically or be ignored after expiry.
* Payment must only proceed for a valid active hold.

## Double Booking Protection

Use a database-safe mechanism such as:

* PostgreSQL transaction
* advisory lock
* exclusion constraint
* atomic RPC
* serializable transaction

If Supabase PostgreSQL is used, prefer an RPC function such as:

```sql
create or replace function create_checkout_hold(...)
returns ...
language plpgsql
security definer
as $$
begin
  -- lock inventory
  -- verify availability
  -- create hold
  -- return hold token
end;
$$;
```

Use the project’s existing migration style.

---

# Phase 4 — Server-Side Pricing Enforcement

## Goal

Never trust browser-provided pricing.

## Implement

In all booking/payment API routes:

* Ignore client-provided final price where possible.
* Recalculate price server-side, or retrieve trusted quoted amount from `checkout_holds`.
* Compare payment gateway amount to trusted hold/reservation amount.
* Reject mismatched payment webhook amounts.
* Reject mismatched currency.
* Reject expired holds.
* Reject duplicate payment confirmations.

## Required Behavior

The payment webhook handler must:

1. Verify cryptographic webhook signature.
2. Extract payment event.
3. Retrieve related checkout hold/reservation from trusted metadata.
4. Compare gateway amount to trusted amount.
5. Compare gateway currency to trusted currency.
6. Confirm booking only once.
7. Log payment event to audit/payment event table.

---

# Phase 5 — Payment Webhook Hardening

## Goal

Payment gateway webhooks must be secure and idempotent.

## Implement

Webhook route should:

* Use raw request body for signature verification if required by the provider.
* Validate webhook signature.
* Validate event type.
* Validate payment status.
* Validate amount and currency.
* Use idempotency key or unique payment event ID.
* Store payment event in database.
* Avoid leaking webhook errors to public logs.
* Return correct HTTP status codes.

## Never Do

* Never trust `success=true` from frontend redirect.
* Never mark booking paid from client-side callback alone.
* Never store full card data.
* Never expose webhook secret to client.
* Never expose payment secret keys to client.

---

# Phase 6 — Staff Dashboard Auth Middleware

## Goal

Protect all dashboard/admin routes before rendering sensitive data.

## Implement

Add or verify middleware protecting routes such as:

* `/dashboard`
* `/dashboard/*`
* `/admin`
* `/admin/*`
* `/settings`
* `/settings/*`
* `/bookings/manage`
* Any route exposing staff or booking data

## Requirements

* User must be authenticated.
* User must be staff/manager/admin.
* Unauthorized users must be redirected or denied.
* Sensitive data must not be rendered before auth verification.
* Server-side data loading must also enforce access control.

## Suggested Role Hierarchy

Use:

* `staff`
* `manager`
* `admin`

Permissions should be enforced through database RLS and server-side checks, not only UI hiding.

---

# Phase 7 — RBAC & RLS

## Goal

Enforce access control at the database layer.

## Implement or verify:

* Staff users can view bookings needed for operations.
* Managers can edit bookings and mark PMS sync status.
* Admins can manage staff roles/settings.
* Public/anonymous users cannot read customer PII.
* Customers/guests can only access their own booking through secure tokenized flows.
* Service role is used only server-side.

## Required Database Controls

Use Supabase RLS policies where applicable.

Suggested tables needing RLS:

* `reservations`
* `checkout_holds`
* `customers`
* `reservation_payment_events`
* `reservation_edit_events`
* `reservation_sync_events`
* `staff_profiles`
* `consent_records`

Do not weaken existing policies.

---

# Phase 8 — Audit Logging

## Goal

Create immutable records of sensitive actions.

## Implement audit event logging for:

* Staff login, if feasible
* Booking creation
* Booking edit
* Booking cancellation
* Payment confirmed
* Payment failed
* Refund initiated
* Refund completed
* PMS sync status changed
* Customer data viewed, if feasible
* Customer data exported
* Customer data anonymized/deleted
* Staff role changed
* Settings changed

## Suggested Tables

Use existing naming if present, otherwise create:

* `reservation_payment_events`
* `reservation_edit_events`
* `reservation_sync_events`
* `staff_audit_events`
* `consent_records`

## Audit Log Requirements

Audit logs should include:

* `id`
* `event_type`
* `actor_type`
* `actor_id`
* `reservation_id`, if applicable
* `customer_id`, if applicable
* `metadata` as JSONB
* `ip_address`, if available
* `user_agent`, if available
* `created_at`

## Important

Audit logs should be append-only in normal application flows.

Do not create normal UI delete actions for audit logs.

---

# Phase 9 — Manual PMS Sync Workflow

## Goal

Support the “Human API” workflow where staff manually copy bookings into the physical PMS.

## Implement

In staff dashboard booking detail/list:

* Show PMS sync status.
* Allow authorized staff/manager to mark booking as:

  * `pending_sync`
  * `synced`
  * `sync_failed`
  * `needs_review`
* Record who changed the sync status.
* Record timestamp.
* Record optional note.
* Write each sync status change to `reservation_sync_events`.

## UI Requirements

Staff should be able to see:

* New bookings needing PMS sync
* Failed sync items
* Already synced bookings
* Timestamp of last sync action
* Staff member who marked it synced

---

# Phase 10 — Data Access, Export & Anonymization

## Goal

Support PDPA-style customer data operations.

## Implement in staff dashboard, restricted to manager/admin:

### Customer Data Export

Export a customer profile as JSON containing relevant personal data:

* Customer profile
* Bookings
* Payment references, not full card data
* Consent records
* Communication preferences

### Customer Data Anonymization

Allow manager/admin to anonymize customer PII where legally and operationally safe.

Replace PII fields with safe placeholders, for example:

* Name: `Redacted`
* Email: anonymized synthetic value
* Phone: null or redacted
* Notes: remove/redact if they may contain PII

## Important

Do not delete financial records required for accounting/legal retention.

Prefer anonymization over hard deletion where bookings/payments must remain for records.

Log all export/anonymization actions.

---

# Phase 11 — Retention Job

## Goal

Avoid keeping unnecessary sensitive data forever.

## Implement or verify a database retention job.

If a function like `run_hotel_retention_jobs()` exists, update it to include new audit/consent/payment tables.

Retention should account for:

* Booking records
* Payment event references
* Audit logs
* Consent records
* Expired checkout holds
* Failed/abandoned holds

## Suggested Behavior

* Expired checkout holds can be deleted or archived after a short period.
* Financial/payment references should be retained according to business/accounting needs.
* Consent records linked to bookings should be retained as long as needed to prove lawful basis.
* Audit logs should not grow forever.

If legal retention duration is uncertain, make values configurable and document assumptions.

---

# Phase 12 — Timezone Safety

## Goal

Prevent booking date disputes caused by timezone mismatch.

## Implement

All booking dates should be normalized to the hotel timezone:

```ts
const HOTEL_TIMEZONE = "Asia/Bangkok";
```

Requirements:

* Store date-only fields consistently for check-in/check-out.
* Display booking dates in Asia/Bangkok.
* Avoid accidental UTC date shifting.
* Validate that check-out is after check-in.
* Validate minimum/maximum stay rules if applicable.
* Ensure confirmation emails and dashboard display match.

Do not rely blindly on browser local timezone.

---

# Phase 13 — Security Headers & API Protection

## Goal

Add practical baseline security protections.

## Implement where applicable:

* HTTPS-only assumptions
* Secure cookies
* HttpOnly cookies where possible
* SameSite cookie policy
* CSRF protection for staff dashboard mutations
* Rate limiting for availability search and checkout hold creation
* Input validation using existing validation library or Zod
* Content Security Policy if compatible
* Server-side environment variable validation

Do not break legitimate payment gateway redirects or webhooks.

---

# Phase 14 — Environment Variable Validation

## Goal

Prevent misconfigured production deployments.

## Implement a centralized env validation file if not present.

Validate required server variables such as:

* Supabase URL
* Supabase anon key
* Supabase service role key, server-only
* Payment gateway secret key
* Payment webhook secret
* Site URL
* Hotel timezone
* Legal document versions

Ensure client-exposed env vars are explicitly separated from server-only variables.

---

# Phase 15 — Tests / Verification

Add or update tests where the project already supports testing.

Prioritize tests for:

* Checkout hold creation
* Expired hold rejection
* Payment amount mismatch rejection
* Payment currency mismatch rejection
* Duplicate webhook idempotency
* Dashboard route protection
* RBAC permission checks
* Consent required before checkout
* Timezone date normalization

If no test framework exists, add a lightweight verification checklist instead of installing heavy tooling without approval.

---

# Implementation Priorities

Implement in this order:

1. Repository audit
2. Auth/dashboard route protection
3. Legal versions and consent storage
4. Checkout hold hardening
5. Server-side pricing/payment webhook validation
6. Audit logging
7. PMS sync workflow
8. Customer export/anonymization
9. Retention job
10. Timezone safety
11. Security headers/rate limiting
12. Tests or verification checklist

---

# Do Not Overbuild

Avoid:

* Full microservice rewrite
* New queue system unless needed
* New auth provider unless existing auth is insufficient
* Complex event sourcing unless already used
* Storing passport images online unless explicitly required
* Collecting unnecessary personal data
* Building full legal ticketing system before launch

Prefer:

* Supabase RLS
* PostgreSQL functions
* Clear server-side API routes
* Simple staff dashboard workflows
* Append-only audit logs
* Configurable constants
* Small, composable utilities

---

# Final Response Required From Codex

When you finish, respond with:

```md
# Implementation Summary

## Files Changed

- ...

## Features Added

- ...

## Security Improvements

- ...

## Compliance Improvements

- ...

## Database Changes

- ...

## Environment Variables Added

- ...

## Manual Setup Required

- ...

## Tests / Verification

- ...

## Questions / Missing Information

- ...
```

Be specific. Do not say “implemented compliance” vaguely. Explain what was actually changed.
