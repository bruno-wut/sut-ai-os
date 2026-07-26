# Initial Hotel Configuration — Staging Acceptance Test Plan

## 1. Purpose

Use this plan to prove that the one-time **Initial Hotel Configuration** wizard:

1. accepts only valid hotel, room, rate, gallery, amenity, and web-allocation data;
2. writes one complete and internally consistent inventory plan;
3. publishes only the approved physical rooms for website sale;
4. preserves room-detail content and Cloudflare R2 image references;
5. synchronizes Staff inventory and the guest IBE after completion; and
6. fails safely without exposing unintended rooms for sale.

This is an acceptance plan for staging. It is not authorization to reset or alter production.

## 2. Safety and environment rules

The setup operation is intentionally one-time. A successful run creates the hotel's room types,
physical rooms, and 365-day allotment calendar and sets `setup_completed_at`. Do not run the success
case against a database or hotel tenant that must be preserved.

- Use a fresh, disposable staging hotel tenant or a restorable staging database snapshot.
- Take a database snapshot before the final **Generate inventory** action.
- Do not use `supabase/scripts/production-clean-slate.sql` to repeat this test. That script preserves
  hotel configuration and inventory; it is not an onboarding reset.
- Do not manually delete inventory rows to make the wizard reusable. Use a DBA-approved snapshot
  restore or provision a new test hotel.
- Run destructive fault-injection cases only on an isolated clone, never on shared staging.
- Record the staging deployment/commit, tester, browser, test hotel UUID, and start time.

Recommended test cycles:

| Cycle | Environment | Purpose |
|---|---|---|
| A | Fresh staging tenant, before submission | Navigation, form validation, uploads, permissions |
| B | Fresh staging tenant or restored snapshot | Full successful setup and end-to-end synchronization |
| C | Isolated clone only | Server/RPC failure and recovery tests |

## 3. Roles, devices, and evidence

Test with these accounts:

- Active `admin`
- Active `manager`
- Active non-manager staff member
- Signed-out browser session
- If available, inactive or unlinked staff account

Minimum browser coverage:

- Desktop Chrome at approximately 1440 px width
- Mobile Safari or Chrome at approximately 390 px width
- One keyboard-only pass on desktop

For every failed test, capture:

- screenshot or screen recording;
- exact time in Asia/Bangkok;
- page URL and account role;
- browser Console and Network error, if any;
- relevant SQL verification output; and
- reproduction steps.

Use a worksheet with: `ID | Result | Actual result | Evidence link | Defect ID | Retest result`.

## 4. Golden baseline for the approved default plan

The untouched wizard defaults must resolve to the following values:

| Room type | Physical rooms | Website rooms | Nightly rate (THB) |
|---|---:|---:|---:|
| Classic Room (Twin) | 59 | 18 | 900 |
| Classic Room (Double) | 23 | 8 | 900 |
| Deluxe Room | 6 | 3 | 1,400 |
| Studio Suite | 8 | 4 | 1,600 |
| Executive Room (Twin) | 6 | 3 | 1,600 |
| Executive Room (Double) | 7 | 3 | 1,600 |
| Executive Suite | 1 | 1 | 3,200 |
| Grand Residence | 1 | 1 | 4,000 |
| **Total** | **111** | **41** | — |

The fixed hotel settings are:

- Hotel: Sri U-Thong Grand Hotel
- Timezone: `Asia/Bangkok`
- Currency: `THB`
- Operational day rollover: `04:00`
- Inventory horizon: `365` days

For a clean default run, the database acceptance totals are:

- 8 active room types
- 111 active physical rooms
- 41 rooms with `web_allocation_enabled = true`
- 40,515 allotment rows (`111 × 365`)
- 14,965 initially open website allotments (`41 × 365`)
- 25,550 initially closed non-web allotments (`70 × 365`)
- 1 completed inventory generation run with `expected_rows = generated_rows = 40,515`

The operational start date is the Bangkok hotel date. Between midnight and 03:59 Bangkok time, it
must still be the previous operational date.

## 5. Pre-flight checks

### PRE-01 — Deployment and dependencies

1. Confirm the intended staging deployment is live.
2. Confirm staging uses its staging Supabase project, not production.
3. Confirm the R2 binding is configured and `https://assets.sriuthonghotels.com` is reachable.
4. Run the normal automated checks before manual testing:

   ```sh
   pnpm test
   pnpm exec tsc --noEmit
   pnpm run verify:images
   pnpm run verify:images:remote
   ```

**Pass:** all commands complete successfully, or every unrelated pre-existing failure is documented
and approved before acceptance begins.

### PRE-02 — Clean tenant

Run this in the staging Supabase SQL editor and retain the hotel UUID:

```sql
select
  id,
  hotel_name,
  timezone,
  currency,
  operational_day_rollover,
  inventory_horizon_days,
  setup_completed_at
from public.hotel_settings
order by created_at;
```

For the chosen test hotel, verify before the success run:

```sql
select
  (select count(*) from public.room_types where hotel_id = '<HOTEL_UUID>'::uuid) as room_types,
  (select count(*) from public.physical_rooms where hotel_id = '<HOTEL_UUID>'::uuid) as physical_rooms,
  (select count(*) from public.physical_room_allotments where hotel_id = '<HOTEL_UUID>'::uuid) as allotments,
  (select count(*) from public.inventory_generation_runs where hotel_id = '<HOTEL_UUID>'::uuid) as generation_runs;
```

**Pass:** `setup_completed_at` is null and all four counts are zero.

## 6. Access control and routing

| ID | Action | Expected result |
|---|---|---|
| ACL-01 | Open `/staff/onboarding` as admin | Wizard loads with no authorization error. |
| ACL-02 | Open it as manager | Wizard loads and permits image upload/setup. |
| ACL-03 | Open it as non-manager staff | Redirects to `/staff/dashboard`; wizard data is not exposed. |
| ACL-04 | Open it signed out | Authentication flow protects the page. |
| ACL-05 | Attempt an R2 upload with a non-manager or stale session | Server rejects it; no usable URL is added. |
| ACL-06 | Attempt setup with an inactive/unlinked staff account | Safe error is shown; no inventory rows are created. |

**Critical rule:** hiding a button is not sufficient. Confirm the server action/RPC also rejects the
unauthorized request.

## 7. Wizard behavior and data entry

### WIZ-01 — Step 1: hotel details

1. Open the wizard as admin.
2. Verify the hotel name and all four fixed operational settings match section 4.
3. Confirm the page title and explanation clearly identify this as initial configuration.
4. Use browser Back/Forward and refresh before submission.

**Pass:** values remain correct, layout is readable, and no database changes occur.

### WIZ-02 — Step 2: default inventory

1. Confirm all eight approved room types appear.
2. Compare the physical-room count, web-room count, and rate for every row with section 4.
3. Confirm the total is 111 physical rooms and 41 website rooms.
4. Expand every **Guest-facing room details** section.
5. Verify each type has at least one gallery image, one amenity, a positive room size, at least one
   adult, an English bed configuration, an English description of at least 20 characters, and a
   valid extra-bed policy.

**Pass:** all default values are present and no room number appears under two room types.

### WIZ-03 — Navigation and unsaved state

1. Change a harmless field, such as a description.
2. Continue to Review, then go back to Rooms & rates.
3. Confirm the edit is retained.
4. Confirm repeated Continue/Back clicks do not duplicate room types or images.
5. Refresh once and record whether unsaved data resets; this is acceptable only if no save promise
   is shown and the reset is clear to the tester.

### WIZ-04 — Add and remove room type

1. Add a room type and verify the new row has editable guest-detail defaults.
2. Remove it and confirm totals return to the golden baseline.
3. Try to remove room types until only one remains.

**Pass:** one room type always remains, IDs/UI state do not collide, and totals update immediately.

## 8. Gallery and Cloudflare R2 tests

Use a non-Classic type such as **Deluxe Room** for authoritative end-to-end gallery testing. When
`STAGING_PREVIEW_ENABLED=true`, Classic Room intentionally receives a temporary three-image staging
fixture, so its guest gallery is not a clean proof of database-to-IBE image synchronization.

Prepare:

- two valid landscape photos with visibly different content, one JPEG and one WebP, each under 5 MB;
- one valid PNG or AVIF under 5 MB;
- one image larger than 5 MB; and
- one unsupported file such as PDF or SVG.

| ID | Action | Expected result |
|---|---|---|
| IMG-01 | Upload two valid files together | Both upload; each URL is appended once. |
| IMG-02 | Inspect returned URLs | Every new URL starts with `https://assets.sriuthonghotels.com/library/images/rooms/`. |
| IMG-03 | Open each canonical URL privately | HTTP 200 and an image content type; no authentication required. |
| IMG-04 | Reorder URL lines | The first line becomes the booking-card cover after setup. |
| IMG-05 | Paste a valid canonical R2 room URL | It is accepted and retained. |
| IMG-06 | Paste a local path or unrelated external URL | Submission is rejected; no inventory is written. |
| IMG-07 | Upload a file over 5 MB | Clear size error; no URL is added. |
| IMG-08 | Upload PDF/SVG or spoofed unsupported type | Clear type error; no URL is added. |
| IMG-09 | Fill all eight gallery slots | Eight are accepted and further upload is disabled/rejected. |
| IMG-10 | Leave the gallery empty | Setup cannot complete; at least one image is required. |
| IMG-11 | Trigger an upload failure or go offline | Existing gallery values remain intact and the wizard remains usable. |

For IMG-01, inspect R2 and confirm the object key is under `library/images/rooms/`, the content type
matches the file, and the immutable cache metadata is present. Do not delete uploaded objects until
the rollback window has passed.

## 9. Validation and negative test matrix

Perform these before the successful submission. Restore the valid value after each case.

| ID | Invalid condition | Expected result |
|---|---|---|
| VAL-01 | Blank room type name | Submission blocked with a specific error. |
| VAL-02 | Duplicate room type names, ignoring case | Rejected as non-unique. |
| VAL-03 | Two names that generate the same code | Rejected as non-unique generated codes. |
| VAL-04 | Name containing no letters/numbers | Rejected. |
| VAL-05 | Same physical room number in two types, ignoring case | Rejected as duplicate. |
| VAL-06 | Blank physical-room list | Rejected; every type needs at least one room. |
| VAL-07 | Website room not present in that type's physical-room list | Rejected. |
| VAL-08 | Blank website allocation for the whole hotel | Rejected safely; no rooms open for sale. |
| VAL-09 | Negative rate | Rejected. |
| VAL-10 | Rate above 1,000,000 | Rejected. |
| VAL-11 | Room size 0 or above 1,000 m² | Rejected. |
| VAL-12 | Maximum adults 0 or above 20 | Rejected. |
| VAL-13 | English description under 20 characters or over 1,500 | Rejected. |
| VAL-14 | Bed configuration blank or over 160 characters | Rejected. |
| VAL-15 | No amenities selected | Rejected. |
| VAL-16 | More than eight images | Rejected or prevented. |
| VAL-17 | Double-click Generate inventory / submit during slow network | Only one initialization occurs. |

Where the UI prevents entry, record that behavior and supplement it with an automated/server test
that submits the malformed payload directly. The server, not only the browser, must enforce these
rules.

## 10. Review and confirmation

### REV-01 — Review totals

On the Review step, verify:

- 8 room types;
- 111 physical rooms;
- 41 website rooms;
- gallery image total equals the sum shown in each editor;
- 8 non-empty amenity profiles; and
- 365-day horizon.

### REV-02 — Explicit confirmation

1. Leave the confirmation checkbox clear.
2. Verify **Generate inventory** is disabled.
3. Select the checkbox.
4. Verify the button becomes enabled.
5. Return to a previous step and back; verify confirmation behavior is safe and understandable.

### REV-03 — Final payload review

Before submitting, export screenshots of all eight room types, their physical rooms, website-room
allocation, rates, gallery order, guest details, and amenities. This is the approved source of truth
for the post-write comparison.

## 11. Successful initialization

### GEN-01 — Generate once

1. Open Network and Console recording.
2. Select the confirmation checkbox.
3. Click **Generate inventory** once.
4. While processing, confirm the button says **Generating inventory...** and cannot be clicked again.
5. Wait for the completion screen.

**Pass:** there is no console error, the wizard reports success, and the completion action links to
`/staff/inventory`.

### GEN-02 — Immediate safe behavior

1. Open `/staff/inventory` from the completion screen.
2. Return to `/staff/onboarding` and try to initialize again without changing the database.

**Pass:** the inventory page loads and the second initialization is rejected as already initialized.
No duplicate room types, rooms, allotments, or generation run is created.

## 12. Database synchronization checks

Replace `<HOTEL_UUID>` in every query.

### DB-01 — Hotel setup marker

```sql
select
  hotel_name,
  timezone,
  currency,
  operational_day_rollover,
  inventory_horizon_days,
  setup_completed_at
from public.hotel_settings
where id = '<HOTEL_UUID>'::uuid;
```

**Pass:** fixed values match section 4 and `setup_completed_at` is non-null at the test time.

### DB-02 — Room-type and web-allocation totals

```sql
select
  rt.name,
  rt.code,
  rt.base_nightly_rate,
  count(pr.id) filter (where pr.is_active) as physical_rooms,
  count(pr.id) filter (where pr.is_active and pr.web_allocation_enabled) as website_rooms,
  jsonb_array_length(rt.gallery_image_urls) as gallery_images,
  cardinality(rt.amenities) as amenities
from public.room_types rt
left join public.physical_rooms pr
  on pr.hotel_id = rt.hotel_id
 and pr.room_type_id = rt.id
where rt.hotel_id = '<HOTEL_UUID>'::uuid
group by rt.id
order by rt.name;
```

**Pass:** all eight rows match the golden baseline and each gallery/amenity count is 1–8/at least 1.

### DB-03 — Guest-detail fidelity

```sql
select
  name,
  image_url,
  gallery_image_urls,
  room_size_sqm,
  max_adults,
  bed_configuration,
  bed_configuration_th,
  extra_bed_policy,
  full_description,
  full_description_th,
  amenities
from public.room_types
where hotel_id = '<HOTEL_UUID>'::uuid
order by name;
```

**Pass:** every value exactly matches the pre-submit review. Each `image_url` equals the intended
first/cover image, galleries preserve order and contain only approved image sources, and stable
amenity IDs—not translated display labels—are stored.

### DB-04 — Generation run and allotment coverage

```sql
select
  status,
  range_start,
  range_end_exclusive,
  expected_rows,
  generated_rows,
  error_message,
  started_at,
  completed_at
from public.inventory_generation_runs
where hotel_id = '<HOTEL_UUID>'::uuid
order by started_at;

select
  min(date) as first_date,
  max(date) as last_date,
  count(distinct date) as covered_days,
  count(*) as allotment_rows,
  count(*) filter (where is_available and not is_booked) as open_unbooked_rows,
  count(*) filter (where not is_available and not is_booked) as closed_unbooked_rows
from public.physical_room_allotments
where hotel_id = '<HOTEL_UUID>'::uuid;
```

**Pass:** exactly one completed run; expected/generated are 40,515; coverage is 365 dates; rows are
40,515; open/closed are 14,965/25,550 on a clean tenant; and `last_date = first_date + 364`.

### DB-05 — Every room has complete coverage

```sql
select pr.room_number, count(pra.id) as covered_days
from public.physical_rooms pr
left join public.physical_room_allotments pra
  on pra.hotel_id = pr.hotel_id
 and pra.room_id = pr.id
where pr.hotel_id = '<HOTEL_UUID>'::uuid
group by pr.id, pr.room_number
having count(pra.id) <> 365;
```

**Pass:** zero rows.

### DB-06 — Availability matches persistent web allocation

```sql
select
  count(*) filter (where pr.web_allocation_enabled) as web_rooms,
  count(*) filter (where not pr.web_allocation_enabled) as non_web_rooms,
  count(*) filter (
    where pra.is_available is distinct from pr.web_allocation_enabled
      and not pra.is_booked
  ) as mismatched_unbooked_allotments
from public.physical_rooms pr
join public.physical_room_allotments pra
  on pra.hotel_id = pr.hotel_id
 and pra.room_id = pr.id
where pr.hotel_id = '<HOTEL_UUID>'::uuid;
```

**Pass:** the distinct-room totals are 41/70 when checked separately, and mismatches are zero. The
aggregate web/non-web counts in this joined query are room-night counts, not distinct-room counts.

Use this distinct-room query for the 41/70 assertion:

```sql
select
  count(*) filter (where web_allocation_enabled) as web_rooms,
  count(*) filter (where not web_allocation_enabled) as non_web_rooms
from public.physical_rooms
where hotel_id = '<HOTEL_UUID>'::uuid and is_active;
```

### DB-07 — Audit event

```sql
select
  id,
  actor_user_id,
  kind,
  range_start,
  range_end_exclusive,
  affected_rows,
  reason,
  metadata,
  created_at
from public.inventory_change_events
where hotel_id = '<HOTEL_UUID>'::uuid
order by created_at desc;
```

**Pass:** the opening web-allocation event exists, identifies the acting user, records 41 unique room
numbers in metadata, and covers the expected date range.

## 13. Staff inventory synchronization

| ID | Action | Expected result |
|---|---|---|
| STF-01 | Open `/staff/inventory` | 365-day inventory loads without server/client errors. |
| STF-02 | Compare category counts | Eight database room types and all 111 rooms are represented correctly. |
| STF-03 | Inspect a web-enabled room/date | It is available on a clean date. |
| STF-04 | Inspect a non-web room/date | It remains closed to website sale. |
| STF-05 | Change a future allotment through the supported Staff workflow | Refresh preserves the change and audit history records it. |
| STF-06 | Test at a date near the horizon boundary | Last covered date works; the next date is not falsely sold. |

## 14. Guest IBE synchronization

Test both `/en/book` and `/th/book` using a stay fully inside the generated horizon.

The IBE intentionally groups Twin and Double variants, so eight database room types should become
six guest-facing categories: Classic Room, Deluxe Room, Studio Suite, Executive Room, Executive
Suite, and Grand Residence.

| ID | Action | Expected result |
|---|---|---|
| IBE-01 | Search a clean future stay | Six grouped room categories render; availability comes only from the 41-room web pool. |
| IBE-02 | Compare prices | 900, 1,400, 1,600, 1,600, 3,200, and 4,000 THB baselines map to the correct categories. |
| IBE-03 | Compare rooms-left values | Counts agree with open, unbooked allotments for every stay night; grouped Twin/Double counts sum correctly. |
| IBE-04 | Open Room details for the test type | Modal opens, traps focus, closes by button/Escape, and does not lose search state. |
| IBE-05 | Inspect gallery | Images appear in stored order, navigation/count is correct, and no broken frame appears. |
| IBE-06 | Inspect details | Size, capacity, bed configuration, extra-bed policy, descriptions, and amenity sections match Supabase. |
| IBE-07 | Switch EN/TH | Localized labels and Thai fields appear where supplied; fallback content remains readable where Thai is blank. |
| IBE-08 | Inspect Network | Optimized `/_next/image?url=https...assets...` requests return 200 and an image content type; canonical R2 fallback also works. |
| IBE-09 | Search beyond generated horizon | No false availability is offered. |
| IBE-10 | Search above a room's adult capacity | The room is disabled/explained according to the capacity rule, not bookable by mistake. |
| IBE-11 | Complete a reversible staging booking/hold | Availability decreases consistently in IBE and Staff inventory; release/cancel restores it as designed. |

## 15. Failure atomicity and recovery

The workflow has two protected phases:

1. inventory generation; then
2. opening the initial website allocation.

Main inventory generation is atomic. The web-allocation publication is a separate protected RPC.
Therefore test both safe failure states on an isolated clone.

### FAIL-01 — Inventory generation failure

Force a controlled server-side validation/RPC failure before any room plan is accepted.

**Pass:** the user gets a safe error; `setup_completed_at` remains null; room types, rooms, and
allotments are not partially created; the failed run is auditable where applicable.

### FAIL-02 — Web-allocation publication failure

In an isolated clone, make the second RPC fail after inventory creation, for example with a test-only
fault or invalid allocation payload. Do not modify production code or shared staging to simulate it.

**Pass:** the UI reports that physical inventory was created but web sales remain closed. The
database has complete physical inventory, unintended rooms are not available online, and an
administrator can diagnose/recover without rerunning or duplicating initialization.

### FAIL-03 — Network interruption and retry

Interrupt the browser after submission, then reconnect and inspect the database before retrying.

**Pass:** the tester can determine whether setup committed; retry cannot create duplicates; the
system ends in either the complete state or a clearly reported safe state.

### FAIL-04 — Concurrent submissions

Submit the same clean tenant from two authorized sessions at nearly the same time on an isolated
clone.

**Pass:** one succeeds at most; the other is rejected; final counts still equal the golden baseline.

## 16. Accessibility, responsiveness, and polish

| ID | Check | Expected result |
|---|---|---|
| UX-01 | Keyboard-only traversal | Logical focus order; accordions, checkboxes, Back/Continue, and submit work by keyboard. |
| UX-02 | Screen-reader labels | Inputs, remove buttons, upload status, errors, and progress have meaningful names/announcements. |
| UX-03 | Error recovery | Error appears near the relevant context, retains valid data, and moves focus appropriately. |
| UX-04 | 390 px viewport | No inaccessible horizontal content; controls remain tappable and text does not overlap. |
| UX-05 | Slow network | Upload/generation status is visible; no duplicate action or frozen-looking interface. |
| UX-06 | Long but valid text | Layout remains refined in editor, review, Staff, and room-details modal. |

## 17. Exit criteria and sign-off

Setup is accepted only when:

- all critical access, validation, generation, database, R2, Staff, and IBE tests pass;
- there are zero unexplained count mismatches or duplicate identifiers;
- no non-web physical room is available for public booking;
- every persisted gallery URL is an approved canonical source and all tested R2 objects return an image;
- the room-details modal matches persisted content in English and Thai;
- second submission and concurrent submission cannot duplicate inventory;
- failure states keep web sales closed rather than exposing extra rooms; and
- all P0/P1 defects are fixed and retested, with lower-severity exceptions explicitly accepted.

Record final sign-off:

| Item | Value |
|---|---|
| Staging deployment/commit | |
| Test hotel UUID | |
| Snapshot/restore reference | |
| Admin tester | |
| Manager tester | |
| Browser/device set | |
| Completed inventory run ID | |
| Opening web-allocation event ID | |
| Defects and accepted exceptions | |
| Final result and approver | |
