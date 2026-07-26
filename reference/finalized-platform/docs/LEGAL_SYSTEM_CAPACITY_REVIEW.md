# Legal Documents and System Capacity Review

Review date: 2026-07-05

Documents reviewed:

- `privacy_policy_final.md`
- `sri-u-thong-grand-hotel-booking-terms-v1.5.md`
- `sri-u-thong-grand-hotel-cancellation-refund-policy-v1.1.md`

Status: **Do not publish these documents as implemented system behavior until the contradictions below are resolved or the wording is amended.**

## Blocking contradictions

- [x] **Price breakdown:** Checkout now itemizes and charges the room subtotal, 10% service charge, and 7% VAT calculated after service charge.
- [x] **Confirmation timing:** The platform confirmation page now presents a completed confirmation immediately after the booking transaction; later staff processing remains an operational status.
- [x] **Check-in time:** IBE and email messaging now state noon check-in.
- [x] **Children:** The Astro booking bar now defines children as 0–7 and adults as age eight and above. Child counts continue through checkout.
- [ ] **No-show automation:** Terms 6 and Cancellation Policy 5 say reservations automatically become No-Show at 4:00 AM and remaining inventory is released. No implemented no-show scheduler or automatic state transition was found.
- [ ] **Refund execution:** The policies promise gateway refund submission within 7–14 business days. The staff UI records cancellations and safeguards, but no Stripe refund workflow or refund-status tracking was found.
- [ ] **Cancellation fee calculation:** The policies cap late cancellation and no-show charges using deposit or first-night totals including service charge and VAT. The current staff cancellation workflow does not calculate or enforce this cap.
- [ ] **Non-refundable rate plans:** Both documents describe explicitly labeled non-refundable rates. The current IBE does not expose a rate-plan model or non-refundable selection.
- [ ] **Payment gateway fees:** Both documents say non-refundable processing fees will be disclosed before payment. The current checkout does not display a gateway fee disclosure or fee amount.
- [ ] **Sensitive-data consent:** The Privacy Policy says explicit consent will be requested where required for health, allergy, disability, accessibility, religious dietary, or other sensitive requests. The checkout has one free-text requests field but no explicit sensitive-data consent control.
- [ ] **Cookie controls:** The Privacy Policy says analytics or marketing cookies can be managed through a cookie banner/settings. No cookie banner or preference center is implemented.
- [ ] **Temporary hold data:** Booking Terms 2.4 promises deletion, anonymization, or minimization of temporary personal data after unpaid hold expiry. Holds and reservations have retention handling, but this exact expired-hold personal-data lifecycle has not been verified.
- [ ] **Specific-room guarantee:** Booking Terms 7.3 names Grand Residence 1610 as specifically guaranteed inventory. The current public room catalog and booking flow do not expose a specific-room product or guarantee mechanism.
- [ ] **Extra-person and extra-bed fees:** Booking Terms 8.3 says these charges are clearly displayed in room details or checkout. The current IBE does not itemize these charges.

## Material factual inconsistencies

- [x] **Domains:** Public metadata and legal links now use `sriuthonggrand.com` and `book.sriuthonggrand.com`; staging hosts remain unchanged for review.
- [x] **Hotel telephone:** Guest-facing surfaces now use `+66 (0) 35 502 293`.
- [x] **Email addresses:** Booking support uses `reservations@sriuthonghotels.com`; privacy requests use `privacy@sriuthonggrand.com`.
- [ ] **Company identity:** Legal documents identify “Sri U-Thong Grand Hotel Co., Ltd.” and Tax ID `0723545000609`; these details are not otherwise represented or verified in the application configuration.
- [ ] **Language hierarchy:** The legal documents say Thai and English versions are published and Thai controls. Only the supplied English versions were found in this review.
- [ ] **Retention wording:** The implemented reservation policy retains records for seven years. The Privacy Policy describes booking retention less precisely and should explicitly align with the configured seven-year period where appropriate.

## Statements that match current capacity

- [x] 35-minute inventory hold and automatic expiry.
- [x] Stripe-hosted card entry; the hotel does not store full card details.
- [x] Read-only guest booking lookup.
- [x] Staff-mediated cancellations and amendments.
- [x] Asia/Bangkok date handling.
- [x] Role-based staff access and audit history.
- [x] Webhook signature verification.
- [x] Dynamic physical-room allocation within room categories.
- [x] Seven-year reservation retention and PDPA anonymization behavior.

## Recommended publication gate

1. Confirm the authoritative phone numbers, email addresses, company identity, domains, check-in time, child age rule, and Thai-language documents.
2. Choose whether the system will implement itemized service charge/VAT, refunds, no-show automation, cancellation-fee caps, rate plans, sensitive-data consent, and cookie controls—or revise the legal promises to match current operations.
3. Reconcile the approved wording into `src/lib/legal/policies.ts`.
4. Update legal version environment values to the approved effective dates.
5. Re-run legal-page, checkout, cancellation, retention, and payment tests in staging before marking the legal-policy backlog item complete.
