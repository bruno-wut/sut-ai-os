# Sri U-Thong New Chapter

This workspace contains two separate apps:

- `website/astro-site` for the Astro hotel marketing website
- the Next.js Hotel Inventory Bridge at the workspace root

Cloudflare deployment note:

- The root Next.js bridge deploys as a single OpenNext Cloudflare Worker using `wrangler.jsonc`.
- Reservation notification processing and the Resend webhook are handled by that same Worker.

Supporting docs live in `docs/`.

Legal and retention configuration:

- Update guest-facing legal wording in `src/lib/legal/policies.ts` after Thai PDPA/legal review.
- Adjust policy version labels with the `NEXT_PUBLIC_LEGAL_*_VERSION` environment variables.
- Adjust database retention durations in `public.hotel_settings`.
- See `docs/LEGAL_CONFIGURATION_GUIDE.md` for the exact files, environment variables, and SQL.

Live previews:

- Astro website: http://127.0.0.1:4322/
- Guest booking IBE: http://127.0.0.1:3000/book
- Guest booking lookup: http://127.0.0.1:3000/lookup
- Staff dashboard: http://127.0.0.1:3000/staff/dashboard

Project folders:

- Astro website source: `website/astro-site`
- Bridge app source: workspace root
