# Feature Polish & Content Integration Backlog

Last updated: 2026-07-10

This is the durable progress checklist for the Astro storefront and the Next.js hotel IBE and Staff Dashboard.

## Checklist convention

- `[x]` Completed and verified.
- `[ ]` Not completed.
- `[~]` Partially completed or awaiting final verification.
- Future implementation work should update this checklist in the same change that completes an item.
- Work remains staging-only unless production is explicitly authorized.
- Never use production Supabase, production Cloudflare variables, Stripe Live keys, or local Wrangler deployment.

## Completed foundation

- [x] OpenNext Webpack and chunk-loading fix.
- [x] Stripe fetch transport.
- [x] Stripe webhook Basic Auth bypass while retaining signature verification.
- [x] 35-minute room hold and Stripe Checkout expiry alignment.
- [x] Concurrent booking conflict API and UX handling with HTTP 409.
- [x] Staff cancellation safeguards.
- [x] Seven-year reservation retention.
- [x] PDPA staff UI behavior.
- [x] Staff inventory subtracts active checkout holds.
- [x] Reservation status changes increment `edit_version`.
- [x] Astro footer legal links.
- [x] Astro-to-IBE booking handoff.
- [x] Staging guest, staff, payment, concurrency, and expiry tests exercised.
- [x] Production remained untouched.
- [x] Staging Supabase service-role table/function privileges restored for trusted server routes.

## P0 — Content truth and trust

- [~] Replace every public placeholder statement and placeholder image description.
  - [x] Removed guest-visible local booking-lookup credentials.
  - [ ] Replace remaining storefront room, dining, meeting, gallery, and photography placeholders after facts and assets are approved.
- [x] Replace the Agoda placeholder with the confirmed official URL.
- [x] Add the confirmed Facebook URL.
- [x] Keep LINE non-clickable while the official account is pending.
- [x] Replace launch-placeholder legal policies with approved policy content.
- [~] Remove preview aids from ordinary guest journeys.
  - [x] Removed local lookup credentials.
  - [x] Removed guest-facing preview labels from room search, room cards, checkout, and booking lookup.
  - [ ] Replace the simulated pay-at-hotel confirmation control with the service-role finalization flow before launch.
- [x] Fix mojibake and normalize typography and punctuation across both apps.
- [x] Preserve check-in, check-out, adults, children, rooms, and promo code from every Astro booking entry point into `/book` and `/checkout`.
- [x] Verify source encoding uses valid `©`, `·`, and `—` characters.

## P1 — Cross-product journey polish

- [~] Standardize brand terminology, CTA labels, hotel contact details, and room naming.
  - [x] Standardized primary checkout and payment wording.
  - [x] Aligned official phone, reservation email, and legal domains with Booking Terms v1.5.
  - [ ] Complete terminology review after final hotel content is approved.
- [x] Add a clear “Back to hotel website” path throughout the IBE.
- [~] Align reservation messaging across search, availability, hold, Stripe Test redirect, confirmation, expiry, conflict, and lookup.
  - [x] Search, hold, secure-payment redirect, confirmation, and lookup wording aligned.
  - [x] Technical guest wording about atomic holds, webhooks, PMS, and date normalization replaced.
  - [x] Stripe Test returns now distinguish payment received from final hotel confirmation while preserving retry context.
  - [x] Stripe and pay-at-hotel completion now land on confirmation first, then the View Booking action opens lookup with `session_id` or `hold_token` only.
  - [x] Lookup page polls through short webhook/finalization alignment delays and exposes a print-friendly confirmation summary plus front-desk escalation.
  - [ ] Complete live expiry and conflict-state browser verification on staging.
- [~] Review responsive behavior at 320, 360, 390, 768, and desktop widths.
  - [x] Next.js IBE checked at 320, 360, 390, 768, and 1280 pixels with no horizontal overflow.
  - [x] IBE mobile header adjusted for narrow screens.
  - [x] Tightened iPhone Safari date-field sizing and Thai hero/room-card typography on the IBE.
  - [x] Corrected Astro image-wrapper sizing for the homepage event slideshow, room media, and gallery/photo surfaces on iPhone.
  - [x] Added touch-first date selection handling for the Astro reservation drawer calendar on iPhone.
  - [ ] Complete interactive Astro storefront viewport verification.
- [~] Run keyboard, focus-order, contrast, screen-reader-label, and zoom checks across both guest flows.
  - [x] IBE accessible-label and mobile visibility checks completed.
  - [x] Existing automated Axe coverage retained.
  - [x] Astro skip links, focus trapping, labels, reduced-motion support, and responsive rules reviewed in code.
  - [ ] Complete interactive keyboard and focus-order testing for both guest flows.
  - [ ] Complete automated contrast checks for both guest flows.
  - [ ] Complete 200% and 400% zoom/reflow checks for both guest flows.
  - [ ] Complete interactive screen-reader smoke testing.
- [x] Replace technical guest copy such as “atomic hold” with plain hospitality language.
- [x] Itemize and charge the room subtotal, 10% service charge, and 7% VAT.
- [x] Derive checkout subtotal, service charge, and VAT from the guest-facing final room price so the breakdown always adds back to the displayed grand total.
- [x] Pin Stripe Test Checkout session creation around THB amount math, locale, guest-phone metadata, review metadata, and return/cancel URLs.
- [x] Keep IBE guest details as the phone source of truth and disable Stripe Checkout's duplicate phone prompt.
- [x] Add PromptPay alongside card payments in Stripe Test Checkout while preserving the existing signed webhook finalization path.
- [x] Add cancellation refund review architecture for Stripe Test payments: cancellation-window-aware guest email, editable staff refund amount, reservation-scoped Stripe idempotency key, audited refund request ledger, and `charge.refund.updated` failure reconciliation.
- [x] Add Operations refund-review visibility and manual Stripe Dashboard refund reconciliation so manager-created Stripe refunds sync back to reservation status.
- [x] Show Stripe transaction ID and safe payment-method display in staff ledger: card brand plus last four digits when Stripe exposes them, PromptPay QR for PromptPay, and `-` for pay-at-hotel bookings.
- [x] Store safe Stripe payment method display fields from webhook processing and backfill staging Stripe Test reservations so staff ledger rendering does not call Stripe during page render.
- [x] Add stale checkout-hold recovery so expired/reused idempotency keys return `CHECKOUT_HOLD_STALE` and the checkout UI retries once with a fresh hold.
- [x] Align guest-facing check-in time to 12:00 PM.
- [x] Align child ages to 0–7 and adults to age eight and above.
- [x] Align platform confirmation messaging with Booking Terms v1.5.

## P2 — Staff efficiency

- [~] Rename internal and prototype terminology for front-desk users.
  - [x] Replaced “Hotel inventory bridge”, “Quiet Ledger”, and “Inventory ledger” in shared staff navigation/chrome.
  - [x] Completed the English terminology pass inside dashboard, inventory, reservation, onboarding, and system-health content.
- [x] Remove non-functional week navigation, pagination, and bulk-update controls until backed by working operations.
- [x] Improve the reservation queue for mobile with card-style rows and a full-width “Open reservation” action.
- [x] Clarify stale-delivery, cancellation, payment-review, and inventory-hold messages.
- [ ] Validate common staff tasks with keyboard-only use and realistic reservation volume.
- [x] Replace “Hotel Tetris” with staff-friendly room-reassignment language.
- [x] Review client-side reservation filtering behavior; the server deliberately limits the queue to the latest 20 reservations and the UI now states that bound.

## P3 — Maintainability and performance

- [~] Keep staging deployment plumbing healthy.
  - [x] Verified the Next.js OpenNext Cloudflare bundle builds locally on 2026-07-07.
  - [x] Confirmed staging Supabase service-role access and staff-profile assignment on 2026-07-07.
  - [x] Confirmed `staging-preview-7q2x.sriuthonghotels.com` is reaching protected Next.js routes again on 2026-07-08; `/staff/dashboard` returns the expected protected response and `/api/stripe/webhook` returns the expected POST-only method response.
  - [x] Investigated staff-screen Cloudflare Error 1102 during cancellation on 2026-07-09; staging evidence showed cancellation and notification rows completed successfully, with the leading Worker-resource suspect being Stripe SDK inclusion in the standard staff action bundle plus post-action refresh.
  - [x] Split Stripe refund issuing into `src/app/(staff)/staff/reservations/[id]/stripe-actions.ts` so standard staff cancellation/edit/override/PMS actions no longer import or bundle Stripe directly.
- [~] Consolidate duplicated images and establish one source-of-truth asset map.
  - [x] Replaced the Astro `imageRegistry.js` pattern with content-collection-driven `images/library.json`, `page-media/*.json`, and `galleries/main.json` records plus Cloudflare-aware resolvers.
  - [x] Updated the Astro image schema to enforce `cloudflareId` and `altText`, and added Cloudflare-image fallback protection to prevent broken guest-facing `<img>` output.
  - [ ] Remove temporary local fallback files and finish the Cloudflare Images ID rollout after final photography is uploaded.
- [ ] Split oversized global stylesheets into documented product-level sections or modules.
- [~] Add shared content/configuration objects for repeated hotel facts across both apps.
  - [x] Centralized the Next.js hotel name, address, phone, reservation email, timezone, check-in/check-out times, and privacy URL.
  - [x] Added a shared global site-configuration layer for contact, social, and legal/PDPA links, and connected the Astro storefront plus Next.js guest surfaces to it.
  - [x] Rewired Astro locale helpers, booking/legal links, booking lookup escalation, and Thai legal markdown hydration so stale domains/emails no longer live outside the shared config layer.
- [x] Add Partytown-based third-party script offloading scaffolding to the Astro storefront.
  - [x] Installed `@astrojs/partytown`, wired the Astro integration, and added an env-driven `ThirdPartyScripts.astro` entry point for future Google Analytics / Facebook Pixel worker-offloaded scripts.
- [~] Establish shared localization infrastructure and Thai-language coverage.
  - [x] Added persistent EN/ไทย locale state and an accessible language switcher to the Next.js application.
  - [x] Added locale-aware HTML language metadata, navigation, drawer, and reservation chrome to the Astro storefront.
  - [x] Added explicit `/en/` and `/th/` route prefixes, English compatibility redirects, canonical URLs, and alternate-language links.
  - [x] Added centralized EN/TH dictionaries for shared navigation, footer, booking controls, and staff navigation.
  - [x] Preserved locale across the Astro-to-IBE handoff, checkout links, Stripe Checkout locale, and Stripe return URLs.
  - [x] Added Trirong headings, Noto Serif Thai body/UI typography, Thai line-height, and wrapping safeguards.
  - [x] Added Thai copy for the primary IBE search and room-selection journey.
  - [x] Localized the complete Thai checkout surface, including guest details, payment choices, consent, totals, assurances, and client-side error fallbacks.
  - [x] Added Thai labels to shared staff navigation.
  - [x] Added visible native EN/ไทย selectors to the Astro and IBE mobile top bars.
  - [x] Removed stale `lang` query parameters when switching locale paths.
  - [x] Fixed 320px Astro reservation-drawer horizontal overflow and relaxed the Thai IBE mobile header.
  - [~] Replaced Thai mobile `ch`-based hero/checkout heading constraints after real iPhone Safari and Chrome rendered narrower title columns than desktop emulation; device recheck still pending.
  - [~] Relaxed Thai checkout wrapping rules and added `min-width: 0` safeguards to checkout grid/flex children after real iPhone WebKit exposed a Thai-only min-content overflow path that EN did not trigger.
  - [~] Translate Astro page bodies, booking-bar calendar/guest popovers, page metadata, and structured data.
    - [x] Centralized Astro page-shell copy, metadata, contact-form labels, footer/header facts, news chrome, and booking-bar popovers into `website/astro-site/src/data/siteCopy.js`.
    - [ ] Finish locale-specific translation coverage for content-collection card bodies, gallery/group titles, media alt text, and other remaining structured content records.
  - [ ] Translate IBE confirmation and lookup content.
  - [x] Translate IBE checkout and approved legal content.
  - [ ] Translate staff page bodies, tables, forms, validation, and operational status messages.
  - [~] Add locale-specific automated regression coverage and browser verification.
    - [x] Added locale path parsing, switching, query/hash preservation, and protected-route regression tests.
    - [x] Verified local `/th/book` returns HTTP 200 with `<html lang="th">`.
    - [x] Verified generated Astro Thai routes contain Thai navigation, locale-preserving links, and `hreflang`.
    - [x] Verified the reservation drawer at 320px and Thai checkout at 320, 360, and 390px without page-level horizontal overflow.
    - [ ] Complete interactive mobile verification on both Cloudflare staging hosts.
- [~] Extend automated checks for booking-handoff parameters, placeholder leakage, responsive overflow, and accessibility.
  - [x] Existing typecheck, lint, unit, Axe, and production-build checks pass.
  - [ ] Add dedicated automated regression coverage for all booking-handoff parameters.
  - [x] Add guest-source checks preventing preview lookup credentials and preview labels from returning.
  - [ ] Add responsive-overflow checks at agreed viewport widths.

## Content and approval dependencies

- [ ] Complete Stripe account verification and provide production-ready documents before Stripe Live can be enabled.
- [ ] Confirm final room names, occupancy, bedding, sizes, amenities, and rates.
- [ ] Confirm restaurant name, hours, breakfast format, and inclusions.
- [ ] Confirm venue capacities, layouts, equipment, and event contacts.
- [ ] Provide official LINE URL.
- [x] Provide official Agoda URL.
- [x] Provide official Facebook URL.
- [x] Integrate the supplied approved English legal wording.
- [x] Confirm and integrate the controlling Thai Booking Terms and Cancellation Policy.
  - [x] Integrated the supplied Thai Privacy Policy for the Thai privacy route.
  - [x] Integrated the supplied Thai Booking Terms for the Thai terms route.
  - [x] Integrated the supplied Thai Cancellation Policy for the Thai cancellation route.
- [ ] Approve final photography and descriptive alternative text.
- [ ] Supply final approved marketing phrases to replace remaining storefront placeholder copy.
- [ ] Supply fluent Thai translations for the remaining Astro page bodies, metadata, booking popovers, IBE confirmation/lookup, and staff operations.
- [x] Thai localization is included in the current polish scope.

## Verification notes

- [x] Next.js TypeScript passed on 2026-07-05.
- [x] ESLint passed on 2026-07-05.
- [x] Vitest passed: 55 tests on 2026-07-05.
- [x] Next.js production build passed on 2026-07-05.
- [x] Astro production build passed on 2026-07-05.
- [x] Thai localization slice: Next.js typecheck, ESLint, 57 Vitest tests, and production build passed on 2026-07-05.
- [x] Thai localization slice: Astro production build passed on 2026-07-05.
- [x] Locale-routing slice: Next.js typecheck, ESLint, 61 Vitest tests, and production build passed on 2026-07-05.
- [x] Locale-routing slice: Astro generated 21 routes and production build passed on 2026-07-05.
- [x] Mobile localization remediation: Next.js typecheck, ESLint, 61 Vitest tests, production build, and Astro 21-route build passed on 2026-07-06.
- [x] Guest/staff polish slice: Next.js typecheck, ESLint, 63 Vitest tests, production build, and Astro 21-route build passed on 2026-07-07.
- [x] Local 320px browser check confirmed the IBE booking page has no page-level horizontal overflow and no guest-visible preview labels on 2026-07-07.
- [x] Staging incident check on 2026-07-07: `staging-preview-7q2x.sriuthonghotels.com` DNS resolves to `198.54.117.242` and HTTPS cannot connect; local OpenNext Cloudflare build passes, so remaining staging reachability work is Cloudflare/DNS route repair.
- [x] Staging Supabase staff access on 2026-07-07: existing Auth user `wwutthinanchai@gmail.com` assigned active `admin` staff profile for `Sri U-Thong Grand Hotel - STAGING TEST`.
- [x] Staging inventory seeded on 2026-07-07: 111 active physical rooms, 37 website-bookable rooms, and 40,515 daily allotment rows from 2026-07-07 through 2027-07-06.
- [ ] Pending verification: rerun iPhone mobile checks for Astro reservation-date selection, Astro media proportions, Thai IBE room-selection copy fit, and reverse-calculated checkout totals after the 2026-07-06 remediation patch.
- [ ] Pending verification: confirm the Thai IBE hero and checkout headings now fill the expected width on real iPhone Safari and Chrome after removing the `ch`-based mobile title caps.
- [ ] Pending verification: confirm Thai checkout no longer widens on real iPhone Safari and Chrome after removing the locale-wide `keep-all` behavior and tightening checkout shrink/wrap rules.
- [x] Stripe Test polish slice: focused Vitest coverage added for Checkout Session amount/locale/return URL payload and live Stripe return confirmation messaging on 2026-07-07.
- [x] PromptPay option slice: Stripe Checkout now requests `card` and `promptpay` payment methods, with guest copy and route payload tests updated on 2026-07-07.
- [x] Stripe phone-friction slice: Stripe Checkout no longer independently asks for phone; webhook finalization continues to use IBE-captured `guest_phone` metadata on 2026-07-08.
- [x] Secure Stripe return lookup slice: Checkout success URL uses only `session_id`, server-side Stripe validation gates the lookup, and pending webhook alignment returns a safe polling summary on 2026-07-08.
- [x] Confirmation-first status-tracking slice: Stripe and pay-at-hotel bookings show confirmation first, then route to lookup with only `session_id` or `hold_token` for safe server-side status resolution on 2026-07-08.
- [x] Stripe refund review staging update on 2026-07-08: applied staging Supabase refund workflow migrations, updated the Stripe Test webhook destination to include `charge.refund.updated`, and rollback-tested refundable cancellation, non-refundable late cancellation, partial refund, duplicate-refund prevention, and failed-refund webhook reconciliation.
- [x] Stripe refund review validation on 2026-07-08: Next.js typecheck, ESLint, 74 Vitest tests, and production build passed after fixing partial-refund payment-event auditing.
- [x] Manual Stripe refund reconciliation slice on 2026-07-08: Next.js typecheck, ESLint, 75 Vitest tests, production build, and migration application through `20260708170000_reconcile_manual_stripe_refunds.sql` passed locally; the full database harness then reached an existing fixture-dependent 24-hour cancellation test precondition.
- [x] Manual Stripe refund reconciliation staging apply on 2026-07-08: `20260708170000_reconcile_manual_stripe_refunds.sql` applied through the Supabase CLI after MCP timeout, migration history was marked, and manually refunded Stripe Test PaymentIntent `pi_3Tqw1TDPPYsaR6hf2DKnNIzY` was reconciled to booking `WEB-20260708-00000018` as refunded with a pending guest refund notification.
- [x] Operations ledger layout and refund-visibility slice on 2026-07-08: refund review became the large top table, PMS queue moved below, System Health stayed as the small side table, and manual Stripe Dashboard refund reconciliation was pushed in commits `de0f03d`, `502f548`, and `e58ecb6`.
- [x] Stripe method display and Worker-resource remediation on 2026-07-08: pushed `9bce6b0` for staff ledger payment method labels, then replaced render-time Stripe lookups with webhook-stored display fields in `2c7d680`; staging migration `20260708173000_store_stripe_payment_method_display.sql` was applied and 13 existing staging Stripe reservations were backfilled.
- [x] Stale checkout hold recovery on 2026-07-08: pushed `b6dd0b4` after Next.js typecheck, focused checkout Vitest tests, ESLint, and production build passed; checkout now refreshes stale hold idempotency once instead of surfacing `HOLD_NOT_ACTIVE`.
- [x] Staff cancellation 1102 side investigation on 2026-07-09: identified that cancellation completed in Supabase while Cloudflare Worker resource pressure likely came from Stripe SDK being bundled through the shared staff actions file; pushed `2f2578a` to isolate refund issuing in `stripe-actions.ts`. Next.js typecheck, ESLint, and production build passed before the push.
- [x] Architecture enhancement slice on 2026-07-10: Astro component/page image-extension sweep returned zero direct `.jpg`/`.png`/`.webp` references, `imageRegistry.js` references were purged, Thai UI text sweep across `.astro`/`.tsx` returned zero matches outside content/dictionary sources, Astro build passed after Partytown integration, and Next.js production build passed after config-layer cleanup.
- [~] `astro check` awaits installation of `@astrojs/check`.
- [~] Astro interactive browser verification remains pending because the local Astro server was not reachable from the in-app browser during the 2026-07-05 review.
