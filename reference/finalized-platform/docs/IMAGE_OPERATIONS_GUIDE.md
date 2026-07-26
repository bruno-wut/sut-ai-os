# Image Operations Guide

## The shared image architecture

All channels use originals stored in the Cloudflare R2 bucket `sri-u-thong-assets` under
`library/images/`.

- Canonical public URL: `https://assets.sriuthonghotels.com/library/images/<filename>`
- Astro storefront: reads the canonical URL from the image library mapping.
- IBE: reads the canonical URL, then Next/OpenNext creates responsive WebP/AVIF sizes through
  `/_next/image`. If optimization fails, the browser falls back to the canonical R2 URL.
- Initial Staff onboarding: uploads setup images to R2 under `library/images/rooms/` and saves
  canonical URLs during the one-time inventory generation.
- Post-initialization Staff Room Types: queues new files in the browser and uploads them to
  `library/images/rooms/` only when the administrator selects **Publish room**. The same audited
  publish updates `room_types.image_url`, ordered `room_types.gallery_image_urls`, room details,
  amenities, and the selected website allocation.

Do not create new `/cdn-cgi/image/` URLs. That route is not enabled for the R2 custom domain.

## Before uploading

Prepare web-ready images as follows:

- Room, hero, dining, event, and gallery photos: landscape, ideally 2400 × 1600 px (3:2).
- Minimum recommended photo size: 1600 × 1067 px.
- JPEG or WebP for photographs; PNG only when transparency is required; AVIF is also accepted by
  Staff upload.
- Keep each original at or below 5 MB. A practical target is 300 KB–1.5 MB.
- Use lowercase descriptive filenames with hyphens, for example `grand-deluxe-room-2026-07.jpg`.
- Never place passwords, guest data, booking references, or private documents in R2.

## Upload manually in Cloudflare R2

1. Open Cloudflare Dashboard → R2 Object Storage → `sri-u-thong-assets`.
2. Open `library` → `images`.
3. For room-specific uploads, open or create `rooms`.
4. Click **Upload** and select the prepared image.
5. Confirm the object content type is an image type such as `image/jpeg` or `image/webp`.
6. Open the public URL in a private browser window and confirm the image appears:
   `https://assets.sriuthonghotels.com/library/images/<filename>`.
7. Run `pnpm run verify:images:remote` after updating mappings.

Prefer a new versioned filename when changing an image. Replacing bytes under the same filename can
remain cached for a long time.

## Astro storefront images

### Add an image to the library

Edit `website/astro-site/src/content/images/library.json` and add an entry containing:

```json
{
  "key": "grand-pool",
  "title": "Grand Pool",
  "altText": "Swimming pool at Sri U-Thong Grand Hotel",
  "r2ObjectKey": "library/images/grand-pool-2026-07.jpg",
  "localFallback": "/images/grand-pool.jpg"
}
```

`key` is the name used by page sections. `r2ObjectKey` is the exact R2 folder and filename.
`localFallback` is optional operational insurance and must exist under
`website/astro-site/public/images/` if supplied.

### Change an image used by a section

Use the image `key` in the relevant content file:

- Home: `website/astro-site/src/content/page-media/home.json`
- Rooms: `website/astro-site/src/content/page-media/rooms.json`
- Dining: `website/astro-site/src/content/page-media/dining.json`
- Meetings and events: `website/astro-site/src/content/page-media/meetings-events.json`
- Location: `website/astro-site/src/content/page-media/location.json`
- Contact: `website/astro-site/src/content/page-media/contact.json`
- Gallery: `website/astro-site/src/content/galleries/main.json`

To update an existing image everywhere, change that key's `r2ObjectKey` once in `library.json`.
To change only one section, add a new library key and update only that section's content file.

Build before promotion:

```sh
pnpm run verify:images
pnpm --dir website/astro-site run build
```

Astro promotion is a separate release action. Do not promote it to production without explicit
authorization.

## IBE room images

The IBE obtains each existing room type's image from the Supabase `room_types.image_url` field.
The first image is the room-card cover. The room-details dialog reads the ordered
`room_types.gallery_image_urls` array and displays up to eight images per room type. Store every
gallery entry as a canonical URL such as:

```text
https://assets.sriuthonghotels.com/library/images/rooms/grand-deluxe-room-2026-07.jpg
```

Do not use local `/images/...` paths for persisted gallery content. Local paths are only fallback
assets for local development and are normalized to R2 where the existing compatibility path
requires it. Next/OpenNext serves responsive optimized variants through `/_next/image`; the
canonical R2 URL remains the fallback source if optimization is unavailable.

Prefer the Staff **Room types** screen for normal operations. To perform an emergency manual change:

1. Upload the new file to R2 and verify its public URL.
2. Open Supabase Dashboard → Table Editor → `room_types`.
3. Find the exact room type.
4. Replace only `image_url` with the canonical R2 URL.
5. Save, open staging `/en/book`, and verify the correct room card.
6. In Network, confirm the active request uses `/_next/image?url=https...assets...` and returns
   `200` with `content-type: image/webp`, `image/avif`, or another image type.

The six displayed categories currently reuse three originals:

- Classic rooms → `grand-superior-room.jpg`
- Deluxe and Executive rooms → `grand-deluxe-room.jpg`
- Studio Suite, Executive Suite, and Grand Residence → `grand-suite-room.jpg`

## Staff website images

During Staff onboarding:

1. Open the room setup step and expand **Guest-facing room details** for a room type.
2. Upload one or more AVIF, JPEG, PNG, or WebP files, each no larger than 5 MB.
3. Staff uploads each original to `library/images/rooms/` in R2.
4. Keep the strongest overview image first; it becomes the booking-card cover.
5. Use up to eight ordered images per room type. The editor also accepts one canonical R2 URL per line.
6. Complete setup only after the gallery order, descriptions, bed policy, capacity, and amenities are correct.

An existing canonical R2 URL can also be pasted into the initial gallery field. Legacy
`imagedelivery.net` URLs remain accepted for existing data migration, but new media should use R2.

After initial setup, `/staff/onboarding` redirects administrators and managers to
`/staff/room-types`. On that screen:

1. Open the required room-type card.
2. Add, remove, or reorder up to eight images. The first image is marked **Cover**.
3. Review descriptions, bed configuration, occupancy, extra-bed policy, and amenities.
4. Select the exact physical rooms that may be sold through the website.
5. Select **Publish room**.
6. Verify the success confirmation, Staff room allocation, and the corresponding IBE details dialog.

New files stay on the staff member's device until step 5. Publishing uploads them to
`library/images/rooms/` and then calls the atomic room-configuration database operation. If the
database publish fails, the action attempts to delete every R2 object created by that attempt. Existing guest content
and allocation remain unchanged. This prevents abandoned edits and failed publishes from creating
orphaned active-gallery objects.

The room-details data also stores room size, maximum adults, bed configuration in English and Thai,
full descriptions in English and Thai, extra-bed policy, and stable amenity identifiers. Amenity
identifiers are localized by the IBE; do not store translated display labels in the database.

## Staging gallery mock

When `STAGING_PREVIEW_ENABLED=true`, the Classic Room receives a temporary three-image gallery using
the canonical room presets:

- `library/images/grand-superior-room.jpg`
- `library/images/grand-deluxe-room.jpg`
- `library/images/grand-suite-room.jpg`

This fixture exists only to exercise the multi-image room-details dialog in staging. It must not be
copied into production room content or treated as a replacement for hotel photography. Remove or
replace the staging fixture once approved room-specific gallery images have been uploaded to R2.

## Synchronize and verify

After any mapping or room preset change:

```sh
pnpm run verify:images
pnpm run verify:images:remote
pnpm exec tsc --noEmit
pnpm --dir website/astro-site run build
```

`verify:images` checks mapping structure and required room mappings. `verify:images:remote` also
checks that each mapped R2 object returns a successful image response.

## Replace an image

Recommended safe replacement:

1. Upload the replacement using a new versioned filename.
2. Verify its public URL.
3. Update the Astro mapping and/or `room_types.image_url`.
4. Build and test staging.
5. Wait until every required channel shows the replacement.
6. Remove the old object only after references have been cleared and rollback is no longer needed.

## Remove an image

1. Search for the image key, object key, and public URL across the repository.
2. Remove or replace all Astro section references.
3. Replace any `room_types.image_url` values that use it.
4. Run local and remote image verification.
5. Test Astro, IBE, and Staff staging behavior.
6. Keep the old R2 object through the rollback period.
7. Delete it from R2 only when no channel or email template references it.

Deleting the R2 object first will create broken images and should be avoided.

## Files that control the system

- Shared Next/Staff R2 URL rules: `src/lib/media.ts`
- IBE room data normalization: `src/lib/booking-data.ts`
- IBE optimized rendering and fallback: `src/components/booking/booking-experience.tsx`
- Initial Staff upload and validation: `src/app/(staff)/staff/onboarding/actions.ts`
- Initial Staff room image interface: `src/components/onboarding/onboarding-wizard.tsx`
- Post-initialization publish/upload action: `src/app/(staff)/staff/room-types/actions.ts`
- Post-initialization room management interface: `src/components/staff/room-type-management.tsx`
- Audited room content/allocation publish: `supabase/migrations/20260721170000_post_initialization_room_type_management.sql`
- R2 Worker binding: `wrangler.jsonc`
- Astro image library: `website/astro-site/src/content/images/library.json`
- Astro media resolver: `website/astro-site/src/data/siteMedia.js`
- Astro image URL helpers: `website/astro-site/src/data/cloudflareImages.js`
- Architecture verifier: `scripts/verify-image-architecture.mjs`
