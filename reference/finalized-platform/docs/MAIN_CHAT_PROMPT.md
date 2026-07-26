# Main Chat Prompt

Paste this into the main thread:

```text
Proceed with the next big step: prepare this project for Cloudflare deployment using the agreed architecture.

Deployment target:
- Astro hotel marketing website on Cloudflare Pages
- Next.js Hotel Inventory Bridge on Cloudflare Workers using OpenNext
- Supabase remains hosted on Supabase

Important implementation rules:
- Enable and account for Cloudflare `nodejs_compat` for the Next.js Worker deployment.
- Do not assume the Next.js app should be deployed as a static Pages site.
- Keep privileged Supabase operations server-side only.
- Public anon availability/search reads may go directly from browser to Supabase when protected by RLS, to reduce Cloudflare Worker request usage.
- Request-scoped auth helpers must be created inside request handlers.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code or browser builds.
- Cache or prerender brochure/static hotel content where appropriate.
- Constrain image sizes/variants deliberately for Cloudflare free-tier friendliness.
- Keep Cloudflare free-tier limits in mind during implementation, especially the 100,000 dynamic requests/day cap.

What I want you to do now:
1. Assess the current repo and identify exactly what config/files/scripts are needed for:
   - Astro -> Cloudflare Pages
   - Next.js -> Cloudflare Workers/OpenNext
2. Implement the repo-side changes needed for Cloudflare deployment.
3. Add or update the required config files and package scripts.
4. Document which dashboard/manual steps I must do myself in Cloudflare, Supabase, Stripe, and email provider dashboards.
5. Flag any code paths that should be moved from server-side to direct browser-to-Supabase access for quota protection.
6. Verify as much as possible locally without disrupting the existing app.
7. After implementation, give me:
   - what you changed
   - what still requires my manual action
   - the exact deployment sequence

Do not do unrelated redesign work. Focus only on Cloudflare deployment readiness and architecture correctness.
```
