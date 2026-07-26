# Legal Configuration Guide

This project now has two places for legal and retention settings.

## Legal wording

The current guest-facing placeholder wording lives in:

- `src/lib/legal/policies.ts`

After Thai PDPA/legal review, update the text in that file and bump the matching version values.

For deployment-specific version labels, set these Cloudflare Pages environment variables:

```text
NEXT_PUBLIC_LEGAL_TERMS_VERSION=YYYY-MM-DD
NEXT_PUBLIC_LEGAL_PRIVACY_POLICY_VERSION=YYYY-MM-DD
NEXT_PUBLIC_LEGAL_CANCELLATION_POLICY_VERSION=YYYY-MM-DD
```

The database also has `public.legal_policy_documents` for storing approved policy text per hotel, policy kind, and version. Use this table when the staff dashboard is later extended to manage legal wording without code changes.

## Retention durations

Retention is configurable per hotel in `public.hotel_settings`.

Adjust these after legal review:

```sql
update public.hotel_settings
set
  audit_retention_months = 24,
  consent_retention_months = 84,
  booking_pii_retention_months = 84,
  abandoned_hold_retention_days = 30
where hotel_name = 'Sri U-Thong Grand Hotel';
```

`booking_pii_retention_months` controls when direct guest identifiers are nulled from finalized reservation rows, consent records, and converted checkout holds. Audit ledgers and completed notification events are pruned by `audit_retention_months`.

Current database constraints allow:

- `audit_retention_months`: 12 to 24 months
- `consent_retention_months`: 12 to 120 months
- `booking_pii_retention_months`: 12 to 120 months
- `abandoned_hold_retention_days`: 1 to 365 days

Run this after changing retention values:

```sql
select public.run_hotel_retention_jobs();
```

The returned JSON includes counters such as `reservation_pii_scrubbed`, `consent_pii_scrubbed`, `checkout_hold_pii_scrubbed`, and `notification_events_deleted`.

## Public hotel contact details

The booking lookup portal uses tenant-specific public contact fields from `public.hotel_settings`.

Update these before production launch:

```sql
update public.hotel_settings
set
  public_contact_phone = '+66 35 501 290-3',
  public_contact_address = '19 Nangpim Road, Suphanburi, Thailand 72000'
where hotel_name = 'Sri U-Thong Grand Hotel';
```

## Booking consent flow

Live checkout should call:

```sql
select public.record_checkout_hold_consent(
  p_hold_token := '<hold-token>',
  p_customer_name := '<guest-name>',
  p_customer_email := '<guest-email>',
  p_customer_phone := '<guest-phone>',
  p_pdpa_consent := true,
  p_marketing_consent := false
);
```

Stripe and pay-at-hotel finalizers now reject holds without required consent.
