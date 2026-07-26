# Initial Hotel Configuration — Staging Test Results

**Execution date:** 2026-07-21  
**Target:** `https://staging-preview-7q2x.sriuthonghotels.com`  
**Scope:** Non-destructive staging acceptance testing through the safe Review state  
**Accounts:** Admin and Front Desk in separate Chrome sessions

## Result

**PASS WITH MINOR FINDINGS** for the non-destructive scope.

The Admin wizard reached Review with the approved 8 room types, 111 physical rooms, 41 website
rooms, 8 gallery entries, 8 amenity profiles, and a 365-day horizon. Front Desk was denied Setup
access. The guest IBE rendered the expected six grouped categories and the staging multi-image room
details dialog loaded canonical Cloudflare R2 images through Next image optimization.

The one-time **Generate inventory** action was not submitted. Database post-generation
reconciliation, real R2 upload, and failure-injection scenarios remain intentionally unexecuted.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| Focused inventory, room details, media, and dialog tests | PASS | 12/12 tests passed across 4 test files |
| TypeScript | PASS | `pnpm run typecheck` |
| Production build | PASS | `pnpm run build`; compiled, typed, and generated all routes |
| Image architecture | PASS | 3 R2 mappings and 3 required room images verified |
| Remote image availability | PASS | All required canonical R2 images reachable |
| Database migrations/regressions | PASS | All migrations and database regression files completed |
| Full unit suite | PARTIAL | 94/95 passed; guest-content safeguard rejects a staging hostname embedded in `guest-header.tsx` |
| Lint | FAIL — pre-existing | 79 warnings, primarily generated Astro `dist/~partytown` files; one source warning in `cloudflareImages.js` |
| Migration-history comparison | BLOCKED | `.env.local` is absent from this workspace |

## Admin onboarding results

| ID | Check | Result | Observed |
|---|---|---|---|
| ACL-01 | Admin can open Setup | PASS | `/en/staff/onboarding` loaded with Setup navigation visible |
| WIZ-01 | Hotel settings are secured | PASS | Hotel, timezone, currency, and rollover inputs were read-only; horizon displayed 365 days |
| WIZ-02 | Approved room categories | PASS | 8 room types displayed |
| WIZ-03 | Approved room plan totals | PASS | 111 physical rooms and 41 website rooms |
| WIZ-04 | Physical room uniqueness | PASS | Zero duplicate physical-room numbers in the form |
| WIZ-05 | Web allocation validity | PASS | Every website room was a member of its room type's physical-room list |
| WIZ-06 | Starting rates | PASS | 900, 900, 1,400, 1,600, 1,600, 1,600, 3,200, and 4,000 THB |
| WIZ-07 | Guest-detail defaults | PASS | Size, capacity, EN/TH bed details, EN/TH descriptions, extra-bed policy, gallery, and amenities displayed |
| WIZ-08 | Gallery/amenity defaults | PASS | Each type showed 1/8 image and 14 amenities |
| REV-01 | Review totals | PASS | 8 types, 8 images, 8 amenity profiles, 111 rooms, 41 web rooms, 365 days |
| REV-02 | Explicit confirmation safeguard | PASS | Generate disabled initially, enabled only when confirmed, disabled again when unchecked |
| REV-03 | Back/Continue navigation | PASS | Returned to Rooms & rates and back to Review without losing approved review totals |
| GEN-01 | Generate inventory | NOT RUN | Intentionally stopped before the irreversible one-time action |

No Admin console warnings or errors were captured during this flow.

## Front Desk authorization results

| ID | Check | Result | Observed |
|---|---|---|---|
| ACL-03A | Setup navigation hidden | PASS | Front Desk menu contained no Setup link |
| ACL-03B | Direct Setup URL denied | PASS | Direct `/en/staff/onboarding` navigation redirected to `/en/staff/dashboard` |
| ACL-03C | Operational access retained | PASS | Dashboard remained available with current operational data |

## Guest IBE synchronization results

| ID | Check | Result | Observed |
|---|---|---|---|
| IBE-01 | Grouped categories | PASS | Classic, Deluxe, Studio Suite, Executive, Executive Suite, and Grand Residence |
| IBE-02 | Baseline rates | PASS | 900, 1,400, 1,600, 1,600, 3,200, and 4,000 THB |
| IBE-03 | Room details trigger | PASS | Every room card displayed a Room details button and photo count |
| IBE-04 | Multi-image gallery | PASS | Classic Room displayed 3 photos and gallery capacity 3/8 |
| IBE-05 | Gallery navigation | PASS | Next advanced from photo 1 to photo 2; pressed thumbnail and counter updated to 2/3 |
| IBE-06 | R2 image architecture | PASS | Image source resolved through `/_next/image` with canonical `assets.sriuthonghotels.com/library/images/...` URL |
| IBE-07 | Image rendering | PASS | Second gallery image completed at 697 × 465 natural pixels |
| IBE-08 | Details fidelity | PASS | Description, bed, size, occupancy, extra-bed policy, and grouped amenities appeared |
| IBE-09 | Keyboard close | PASS | Escape closed the modal |
| IBE-10 | Thai room cards | PASS | Six localized category names and localized card content appeared |
| IBE-11 | Thai room dialog | PASS | Thai description, bed, occupancy, extra-bed policy, gallery controls, and amenity labels appeared |

No guest-page console warnings or errors were captured.

## Findings

### F-01 — Thai stay summary contains English text

**Severity:** Low  
**Page:** `/th/book`

Observed:

```text
2026-07-21 to 2026-07-22 - 1 night
```

Expected: Thai date-range connector and localized night count.

### F-02 — Singular availability grammar

**Severity:** Low  
**Page:** `/en/book`

Observed for one-room categories:

```text
Only 1 rooms left.
```

Expected: `Only 1 room left.`

### F-03 — Guest-content safeguard test rejects staging hostname

**Severity:** Medium build/test hygiene  
**Location:** `src/components/booking/guest-header.tsx`

The full unit suite fails one safeguard because guest-facing source contains the staging storefront
hostname. This does not break the tested staging UI, but it prevents a clean full-suite result.

### F-04 — Lint includes generated distribution files

**Severity:** Low build/test hygiene

ESLint evaluates generated Astro `dist/~partytown` JavaScript and fails under `--max-warnings=0`.
The source warning in `website/astro-site/src/data/cloudflareImages.js` should also be reviewed.

## Not executed in this pass

- Manager-role equivalence: no Manager session was supplied.
- Signed-out and inactive/unlinked-account cases.
- Actual R2 upload, invalid file-type upload, 5 MB limit, and eight-image cap. Uploading would create
  persistent R2 objects.
- **Generate inventory**, second submission, concurrency, interrupted generation, and web-allocation
  failure recovery.
- Post-generation SQL totals: 40,515 allotments, 14,965 open web allotments, 25,550 closed
  non-web allotments, completed generation run, and audit event.
- Booking/hold mutation and subsequent Staff/IBE availability reconciliation.
- Mobile breakpoint validation. The Chrome viewport override did not take effect in the connected
  profile, so this is a test-environment limitation rather than an application result.

## Recommendation

The non-destructive wizard and guest-details experience are suitable to proceed to a controlled
generation rehearsal only after confirming a restorable staging snapshot or disposable hotel
tenant. Before that rehearsal, fix or accept F-01 through F-04 and provide a Manager account if
manager-role parity is required for sign-off.

## Controlled generation rehearsal and R2 upload follow-up

The Admin session uploaded `grand-meeting-room.jpg` to the Deluxe Room gallery. The wizard accepted
the upload and displayed **2/8 images**. The generated canonical asset URL was:

```text
https://assets.sriuthonghotels.com/library/images/rooms/grand-meeting-room-1784633629225.jpg
```

The review step then showed 8 room types, 9 gallery images, 8 amenity profiles, 111 physical rooms,
41 rooms proposed for website booking, and a 365-day horizon.

| ID | Check | Result | Observed |
|---|---|---|---|
| GEN-01 | R2 upload path | PASS | Upload used the canonical `assets.sriuthonghotels.com/library/images/rooms/` architecture |
| GEN-02 | Wizard gallery update | PASS | Deluxe changed from 1/8 to 2/8 images; review total changed from 8 to 9 |
| GEN-03 | Confirmation gate | PASS | Generate remained gated until the exact confirmation checkbox was checked |
| GEN-04 | Duplicate-generation safeguard | PASS | Submission returned `Hotel inventory has already been initialized.` and did not overwrite inventory |
| GEN-05 | Existing Staff inventory health | PASS | Eight room-type rows were visible; physical allocation reported reconciliation with reservation nights |
| GEN-06 | Existing Staff allocation | PASS WITH VARIANCE | Staff showed 37 website rooms; Deluxe showed 2 web / 6 physical and THB 1,400 |
| GEN-07 | Guest availability sync | PASS | Guest Deluxe rate remained THB 1,400 and showed 3 rooms available for the selected stay |
| GEN-08 | Uploaded Deluxe image published to IBE | **FAIL** | Guest Deluxe still showed 1 image after the wizard upload |

### F-05 — Wizard remains editable after initialization, but changes cannot publish

**Severity:** High workflow/data-consistency risk  
**Pages:** `/en/staff/onboarding`, `/th/book`

An initialized hotel can still edit the onboarding draft and upload persistent R2 assets. The final
submission is correctly blocked by the one-time safeguard, so those changes do not reach the active
room configuration. This produced a visible mismatch: the draft proposed 41 website rooms and two
Deluxe images, while active Staff inventory contained 37 website rooms and the guest IBE contained
one Deluxe image.

Recommended correction: redirect initialized hotels from onboarding to a dedicated room-type
management screen, or render onboarding read-only. Room descriptions, amenity profiles, gallery
ordering, and allocations should be editable through an explicit post-initialization workflow that
updates the active room-type records without rerunning inventory generation. Uploads should either
be delayed until Save/Publish succeeds or cleaned up when the draft is abandoned.

### Rehearsal conclusion

The destructive duplicate-generation guard behaved correctly and existing inventory remained
stable. A true first-generation test could not be performed against this tenant because it was
already initialized. The uploaded R2 object exists in the expected architecture, but it is currently
an unpublished/orphaned draft asset and does not appear in the guest Deluxe gallery.

### F-05 implementation status

**Implemented and deployed to staging.** Initialized hotels now
redirect from onboarding to `/staff/room-types`. The dedicated screen publishes room descriptions,
gallery order, capacity, extra-bed policy, amenities, and per-type website allocation through one
audited database operation. New files are queued locally until Publish; database failure triggers R2
cleanup for objects uploaded by that attempt. Regression coverage is in
`supabase/tests/028_room_type_management.sql`.

## Deployed staging retest

**Final Worker version:** `3b8e4f0c-73ce-4af1-bd6c-4b33456e5b44`  
**Database migrations applied through:** `20260721181000_correct_legacy_room_cover_images.sql`

The initialized legacy tenant is now recognized from its active room catalog and completion marker.
`/staff/onboarding` is no longer the operational editor; Admin navigation exposes **Room types** and
the dedicated editor loaded all eight room types with their real physical/web allocations.

The real inventory generator was exercised against the staging database inside an explicit
transaction that rolled back. The test generated two room types, three physical rooms, and 1,095
allotments (3 × 365); published two web rooms; reconciled 730 open and 365 closed allotments; checked
the exact 365-day horizon, completed generation run, guest gallery persistence, allocation audit,
setup completion marker, and duplicate-generation rejection. No temporary rows remained. The same
test is retained as `supabase/tests/029_complete_inventory_generation.sql`.

The previously uploaded mock image was added to Deluxe through the canonical-URL control and
published from Staff. Final guest verification showed:

- Deluxe Room at THB 1,400 with 2 rooms available for the tested stay.
- 34 m², maximum 3 adults, the correct bilingual details, extra-bed policy, and 14 amenities.
- Exactly two unique gallery images: `grand-deluxe-room.jpg` followed by
  `grand-meeting-room-1784633629225.jpg`.
- Both images served through `/_next/image` from canonical `assets.sriuthonghotels.com` R2 URLs.
- Staff inventory remained reconciled at 37 website rooms and Deluxe 2 web / 6 physical.

During the retest, legacy schema defaults temporarily exposed generic 28 m² content and duplicate
Superior covers. Migrations `20260721180000` and `20260721181000` corrected the per-category details
and covers while preserving custom gallery additions; the final browser verification passed.

Final automated status: TypeScript, focused ESLint, image architecture, production/OpenNext build,
all migrations, and database regressions 012–029 passed. Vitest passed 96 of 97 tests; the sole
remaining failure is the pre-existing guest-content safeguard for the hardcoded staging storefront
hostname in `guest-header.tsx`.
