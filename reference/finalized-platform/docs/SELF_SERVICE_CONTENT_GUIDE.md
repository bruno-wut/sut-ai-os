# Self-Service Content Guide

Last updated: 2026-07-10

This guide is for safe owner-side edits that can save Codex credits: translations, placeholder replacement, image replacement, and simple news/blog publishing.

## Before Editing

- Work on staging first.
- Do not edit production dashboard secrets.
- Do not use production Supabase unless a production launch task explicitly requires it.
- Keep filenames simple: lowercase letters, numbers, and hyphens.
- After edits, commit and push through GitHub so Cloudflare staging can build normally.

Useful commands:

```powershell
git status --short
git diff
git add <files-you-edited>
git commit -m "docs: update hotel content"
git push
```

## Where Content Lives

### Astro Storefront Pages

Most public marketing pages live here:

- `website/astro-site/src/pages/[locale]/index.astro`
- `website/astro-site/src/pages/[locale]/rooms.astro`
- `website/astro-site/src/pages/[locale]/dining.astro`
- `website/astro-site/src/pages/[locale]/meetings-events.astro`
- `website/astro-site/src/pages/[locale]/gallery.astro`
- `website/astro-site/src/pages/[locale]/location.astro`
- `website/astro-site/src/pages/[locale]/contact.astro`

Compatibility pages without the explicit locale prefix also exist here:

- `website/astro-site/src/pages/index.astro`
- `website/astro-site/src/pages/rooms.astro`
- `website/astro-site/src/pages/dining.astro`
- `website/astro-site/src/pages/meetings-events.astro`
- `website/astro-site/src/pages/gallery.astro`
- `website/astro-site/src/pages/location.astro`
- `website/astro-site/src/pages/contact.astro`

For most future edits, prefer updating the locale-aware pages under `[locale]`.

### Astro Shared Text and Labels

Shared storefront labels are mostly here:

- `website/astro-site/src/data/dictionaries.js`
- `website/astro-site/src/data/bookingConfig.js`
- `website/astro-site/src/data/locale.js`

Use this area for repeated labels such as navigation, footer, booking buttons, and language-switcher text.

### Next.js IBE and Staff Translations

Next.js translation dictionaries live here:

- `src/lib/i18n/dictionaries.ts`
- `src/lib/i18n/config.ts`

Use `dictionaries.ts` for guest-facing booking, checkout, confirmation, lookup, and staff navigation labels that are already wired into the app.

### Shared Hotel Facts

Shared hotel facts for the Next.js app live here:

- `src/lib/hotel-facts.ts`

This is the right place for repeated facts such as hotel name, address, phone, email, timezone, and check-in/check-out times in the IBE.

## How To Replace Placeholder Text

1. Search for the text you want to replace:

```powershell
rg "text to replace"
```

2. Edit the matching page or dictionary file.
3. Keep English and Thai versions aligned where both exist.
4. Avoid adding claims that are not operationally confirmed yet, such as exact restaurant hours or venue capacities before approval.
5. Run a quick search for obvious placeholders:

```powershell
rg -i "placeholder|coming soon|to be confirmed|sample|dummy|test"
```

## How To Edit Thai Translations

For Astro:

- Open `website/astro-site/src/data/dictionaries.js` for shared labels.
- Open the matching page under `website/astro-site/src/pages/[locale]/` for page body text.
- Update Thai route content in the `th` locale path or locale-specific content blocks.

For Next.js:

- Open `src/lib/i18n/dictionaries.ts`.
- Find the English key first.
- Update the matching Thai value.
- Keep placeholders such as `{count}`, `{roomName}`, `{date}`, or `{reference}` exactly intact.

Important Thai typography notes:

- Do not manually insert spaces into Thai sentences just to force wrapping.
- Do not shorten Thai legal or policy text unless the approved legal source changes.
- After Thai edits, check iPhone-width layouts if the text is used in a heading, button, room card, checkout section, or staff table.

## How The New Image System Works

The Astro storefront is now Cloudflare-first and data-driven.

The source of truth is no longer a JavaScript image registry inside a page or component. Instead, image references live in content JSON files, and the page templates read those files at build time.

Main files:

- `website/astro-site/src/content/images/library.json`
- `website/astro-site/src/content/page-media/home.json`
- `website/astro-site/src/content/page-media/rooms.json`
- `website/astro-site/src/content/page-media/dining.json`
- `website/astro-site/src/content/page-media/meetings-events.json`
- `website/astro-site/src/content/page-media/location.json`
- `website/astro-site/src/content/page-media/contact.json`
- `website/astro-site/src/content/galleries/main.json`

Supporting helpers:

- `website/astro-site/src/data/siteMedia.js`
- `website/astro-site/src/data/cloudflareImages.js`

What each file does:

- `library.json`
  - stores the image catalog
  - each image record can hold `cloudflareId` (the R2 object key), `deliveryUrl`, and a temporary `localFallback`
- `page-media/*.json`
  - controls which image appears on each page section, slideshow, room card, or venue card
- `galleries/main.json`
  - controls gallery groups and the three-photo slide sets for each gallery box

## How To Replace Images

There are now two common update paths.

### Path 1. Best long-term path: use Cloudflare R2 Bucket with Custom Domain

1. Upload the final photo to your Cloudflare R2 bucket under the `library/` folder.
2. Note the filename of the uploaded photo. This filename (matching the exact R2 object name) will be your `cloudflareId`.
3. Open `website/astro-site/src/content/images/library.json`.
4. Find the image record you want to update.
5. Add or replace the `cloudflareId`.
6. Keep or remove `localFallback` depending on whether you still want a local backup during migration.

Example image record:

```json
{
  "key": "grand-lobby",
  "title": "Grand Lobby",
  "altText": "Lobby view at Sri U-Thong Grand Hotel",
  "cloudflareId": "grand-lobby.jpg",
  "localFallback": "/images/grand-lobby.jpg"
}
```

When `cloudflareId` is present and the R2 custom domain environment variable is configured, the storefront will generate the delivery URL automatically.

### Path 2. Transitional path: keep local fallback photos

Use this while final Cloudflare uploads are still incomplete.

1. Replace the matching file in `website/astro-site/public/images/`.
2. Keep the same filename.
3. Do not edit `dist/`; it is generated.

Current fallback/public images include:

- `grand-exterior.jpg`
- `grand-lobby.jpg`
- `grand-superior-room.jpg`
- `grand-deluxe-room.jpg`
- `grand-suite-room.jpg`
- `grand-restaurant.jpg`
- `grand-breakfast.jpg`
- `grand-ballroom.jpg`
- `grand-meeting-room.jpg`
- `grand-event-setup.jpg`
- `grand-dining-table.jpg`
- `grand-location.jpg`
- `grand-neighborhood.jpg`
- `sri-u-thong-text-logo.png`
- `sri-u-thong-text-logo-transparent.png`
- `sut-symbol-transparent.png`

Recommended replacement rules:

- Keep the same filename when replacing an existing fallback image.
- Use high-quality JPG for photography.
- Prefer landscape images for heroes and room cards.
- Avoid tiny compressed files.
- Avoid extremely huge originals; a long edge around 2400-3200px is usually enough for launch use.

## How To Change Which Photo Appears Where

This is now the key editing habit.

### Change the image catalog itself

Edit:

- `website/astro-site/src/content/images/library.json`

Do this when:

- you are adding a new Cloudflare image ID
- you are changing alt text for a specific image asset
- you are introducing a completely new image key

### Change homepage, rooms, dining, events, location, or contact imagery

Edit:

- `website/astro-site/src/content/page-media/home.json`
- `website/astro-site/src/content/page-media/rooms.json`
- `website/astro-site/src/content/page-media/dining.json`
- `website/astro-site/src/content/page-media/meetings-events.json`
- `website/astro-site/src/content/page-media/location.json`
- `website/astro-site/src/content/page-media/contact.json`

Do this when:

- you want the homepage slideshow to use different images
- you want a room card to point to a different image key
- you want a venue card to point to a different image key
- you want a location highlight to use a different photo

### Change the gallery groupings

Edit:

- `website/astro-site/src/content/galleries/main.json`

Do this when:

- you want to change the three photos inside a gallery box
- you want to change gallery section order
- you want to rename a gallery card or slide label

The gallery is now fully data-driven:

- groups live in `galleries/main.json`
- each gallery box can contain multiple slides
- many gallery boxes currently use three photos each

## Environment Variable Needed For R2 Custom Domain

To turn image IDs into final delivery URLs, the Astro and Next.js builds need the R2 custom domain.

Relevant variables:

- `R2_CUSTOM_DOMAIN`
- `PUBLIC_R2_CUSTOM_DOMAIN`
- `NEXT_PUBLIC_R2_CUSTOM_DOMAIN`

Set this to your custom domain pointing to your R2 bucket (e.g. `assets.sriuthonghotels.com`).

## When Image Mapping Must Be Updated

Update `library.json`, `page-media/*.json`, or `galleries/main.json` when:

- you add a completely new image key
- you want a new image to appear in the homepage slideshow
- you want a room card to use a different image
- you want a venue card to use a different image
- you want a gallery tile to show a different set of three photos

You do not usually need to update mapping when:

- you are only improving the same fallback file with the same filename
- you are only swapping a local fallback image file in `public/images`
- you are only changing image quality without changing the image key

## How To Publish A News Or Blog Post

News content lives here:

- `website/astro-site/src/content/news/`

Use the existing sample post as a pattern:

- `website/astro-site/src/content/news/test-suphanburi-weekend-guide.md`

Recommended filename format:

```text
suphanburi-weekend-guide.md
newly-renovated-rooms.md
```

Do not put spaces in filenames.

## Quick QA After Your Own Edits

Check these after every content edit:

- English page still loads.
- Thai page still loads.
- Language switcher keeps you on the equivalent page.
- Mobile header does not become cramped.
- No horizontal scrolling appears on mobile.
- Booking buttons still point to the correct destination.
- Legal footer links still work.
- No placeholder text remains in visible launch sections.

Useful local checks:

```powershell
npm run lint
npm run typecheck
npm test
```

Astro-specific build checks may be run from the Astro project if needed:

```powershell
cd website/astro-site
npm run build
```

## When To Ask Codex For Help

Ask Codex before making changes when:

- The edit changes booking logic, prices, taxes, service charge, or inventory.
- The edit touches Supabase migrations or production data.
- The edit touches Cloudflare environment variables.
- The edit enables Stripe Live or changes Stripe webhook behavior.
- A Thai heading or checkout section breaks on real iPhone Safari or Chrome.
- You need to add a new structured content type rather than editing existing text.

## Owner Content Queue

Use this as your working checklist:

- Final exterior photography:
- Final lobby photography:
- Final room photography:
- Final restaurant photography:
- Final meeting/event photography:
- Final gallery selection:
- Final room descriptions:
- Final dining description:
- Final meeting/event description:
- Final location description:
- Final Thai page body translations:
- Final LINE URL:
