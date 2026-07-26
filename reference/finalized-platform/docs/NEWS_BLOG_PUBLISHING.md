# News & Blog Publishing

The Astro storefront uses build-time Content Collections as the source of truth for News & Blog posts.

## Content Location

- Markdown posts live in `website/astro-site/src/content/news/`.
- Every post must pass the schema in `website/astro-site/src/content/config.ts`.
- The required frontmatter fields are `title`, `publishDate`, `excerpt`, `coverImage`, `author`, and `tags`.
- `coverImage` must be a Cloudflare Images delivery URL from `https://imagedelivery.net/...`.

## Staff CMS Workflow

1. Deploy the Decap CMS admin route at `/admin/` with the Astro storefront.
2. Configure the GitHub OAuth gateway referenced in `website/astro-site/public/admin/config.yml` as `https://cms-auth.sriuthonghotels.com`.
3. Give hotel staff GitHub access only to the repository branch used by the staging or production editorial workflow.
4. Staff create or edit entries in the "News & Blog" collection.
5. Staff upload photos to Cloudflare Images, copy the delivery URL, and paste it into the Cover Image URL field.
6. Decap commits Markdown only; large binary photos stay out of Git.
7. Cloudflare Pages rebuilds the static storefront after the content commit reaches the connected branch.

For an integrated media picker, use `website/astro-site/functions/api/cloudflare-images/direct-upload.js` as the token-backed upload bridge. Configure these Cloudflare Pages environment variables on the staging storefront first:

- `CF_ACCOUNT_ID`
- `CF_IMAGES_ACCOUNT_HASH`
- `CF_IMAGES_API_TOKEN`
- `CMS_UPLOAD_SECRET`

The CMS client sends `Authorization: Bearer <CMS_UPLOAD_SECRET>` and a JSON body such as `{ "fileName": "lobby-cover.jpg" }`. The function returns `uploadURL` plus the final `deliveryURL` to save into `coverImage`. Keep the token in staff-only CMS configuration; never expose the Cloudflare Images API token to the browser.

## AI Agent Workflow

Use `.github/workflows/ai-news-publish.yml` for AI-generated content.

The workflow accepts either manual `workflow_dispatch` input or a GitHub `repository_dispatch` event with type `ai-news-post`. The payload must include:

- `slug`
- `title`
- `publishDate`
- `excerpt`
- `coverImage`
- `author`
- `tags`
- `body`

The workflow writes the Markdown file, runs `npm ci` and `npm run build` in `website/astro-site`, and commits only if Astro validates the content collection successfully.

Example repository dispatch payload:

```json
{
  "event_type": "ai-news-post",
  "client_payload": {
    "slug": "weekend-guide-suphanburi",
    "title": "A Weekend Guide to Central Suphanburi",
    "publishDate": "2026-07-09",
    "excerpt": "A practical two-day plan for guests staying near central Suphanburi.",
    "coverImage": "https://imagedelivery.net/<ACCOUNT_HASH>/<IMAGE_ID>/public",
    "author": "Hotel Management",
    "tags": "Suphanburi,Travel Guide,Sri U-Thong Grand Hotel",
    "body": "Markdown content goes here."
  }
}
```

## Cloudflare Images

The storefront renders Cloudflare Images URLs through `CloudflareImage.astro`, which follows the existing loader pattern and requests width-based variants such as `width=800` or `width=1200` with a quality option. This keeps optimization at Cloudflare's image delivery layer and avoids runtime image compute in Astro.

## Build Trigger

Cloudflare Pages should remain connected to GitHub. Any commit under `website/astro-site/src/content/news/` should trigger the normal Pages build for the storefront branch. No local Wrangler deployment is required for this content workflow.
