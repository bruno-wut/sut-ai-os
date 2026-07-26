Your Next.js application features a clean, logical route separation between guest and staff flows ((guest) vs. (staff) route groups) and implements a modern, minimalist UI leveraging Tailwind CSS and modular components. The visual hierarchy is sound.

However, from an integration and deployment perspective, the Next.js tier is currently a prototype, not a production-ready application. It relies entirely on static fixtures, lacks route protection, uses dangerous client-side timezones, and breaks core Next.js routing paradigms. Deployment must be paused until these architectural disconnects are resolved and wired to your hardened Supabase backend.

II. P0: Production Blockers & Architectural Gaps
1. Missing Security & Route Protection
Location: src/app/(staff)/layout.tsx, src/app/(staff)/dashboard/page.tsx

The Issue: There is absolutely no authentication guard protecting the (staff) routes. Currently, any public user navigating to /dashboard will access the internal ledger.

The Fix: Implement a Next.js Middleware (middleware.ts) to verify Supabase Auth session tokens. Unauthorized users attempting to access /dashboard or /settings must be redirected to a /login page.

2. Timezone Input Trap (Database Desync Risk)
Location: src/components/booking/checkout-experience.tsx

The Issue: The checkout component captures dates using the browser's local timezone (e.g., standard <input type="date"> and new Date()).

The Risk: As identified in the database audit, if a guest in New York books for "today", their local date might be a day behind your property in Bangkok (Asia/Bangkok). Your database will aggressively reject this as a past date.

The Fix: You must enforce Asia/Bangkok timezone sanitization on the client before submission, ensuring all dates sent to the backend create_checkout_hold RPC strictly align with Thai operational time.

3. Missing Data-Fetching & Handoff Integration
Location: src/app/(guest)/book/page.tsx, src/app/(staff)/dashboard/page.tsx

The Issue: Pages are currently injecting hardcoded FIXTURES. There is no actual data fetching, no Server Actions, and no Supabase client instances.

The Fix: Replace ROOM_FIXTURES with React Server Components (RSC) fetching directly from your Supabase physical_room_allotments and room_types tables. Do not pass DB connections to client components; pass serialized data downwards.

III. P1: Next.js Anti-Patterns & Fragile Flows
1. Breaking Single-Page Application (SPA) Routing
Location: src/components/booking/checkout-experience.tsx (Line ~35)

The Issue: Upon simulating a successful booking, the app uses window.location.href = '/confirmation...'; to navigate the user.

The Risk: This forces a hard browser reload, dumping all React state, destroying the Next.js router cache, and degrading perceived performance.

The Fix: Import useRouter from next/navigation and execute router.push('/confirmation...') to preserve the SPA experience.

2. Unsafe searchParams Types and Handling
Location: src/app/(guest)/checkout/page.tsx, src/app/(guest)/confirmation/page.tsx

The Issue: The page components type searchParams: any and destructure it directly (const roomId = searchParams.roomId).

The Risk: In Next.js 15+, searchParams is a Promise and must be awaited. Furthermore, using any hides potential runtime crashes if query parameters are missing or malformed.

The Fix: Strongly type your searchParams (e.g., { searchParams: Promise<{ roomId?: string; checkIn?: string }> }) and validate their presence before rendering the CheckoutExperience. Redirect to /book if required params are missing.

IV. P2: UX, Accessibility (A11y), and UI Integrity
1. Checkout Form Accessibility & Validation
Location: src/components/booking/checkout-experience.tsx

The Issue: The guest detail inputs (Name, Email, Phone) lack autoComplete attributes and form <form> wrapping.

The Risk: Users must type everything manually, increasing friction and cart abandonment. Screen readers lack context.

The Fix: * Wrap the inputs in a <form onSubmit={handleCheckout}>.

Add autoComplete="name", autoComplete="email", and autoComplete="tel" to their respective inputs.

Add required and type="email"/type="tel" to enable native HTML5 validation before the simulated API call fires.

2. Staff Ledger Keyboard Navigation
Location: src/components/staff/inventory-ledger.tsx

The Issue: The grid is rendered using heavy div nesting and click handlers (onClick={() => toggleCell(...)}).

The Risk: Power users (front desk staff) rely heavily on keyboard navigation. A grid constructed solely of clickable divs is inaccessible to screen readers and cannot be navigated via the Tab or arrow keys.

The Fix: Implement WAI-ARIA grid roles (role="grid", role="row", role="gridcell") or refactor using an accessible table structure. Add tabIndex={0} and keyboard event listeners (onKeyDown) for rapid staff input.

3. Missing Active States in Navigation
Location: src/components/staff/staff-sidebar.tsx

The Issue: The sidebar maps through navigation items, but there is no logic to highlight the currently active route.

The Fix: Utilize Next.js usePathname() from next/navigation to compare the current path against the link href. Apply an active CSS class (e.g., bg-muted) and aria-current="page" to the active link for visual and structural clarity.