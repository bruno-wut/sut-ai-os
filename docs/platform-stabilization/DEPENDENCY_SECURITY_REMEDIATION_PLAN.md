# Dependency and Security Remediation Plan

## Outcome

This task produces a plan, not a dependency update. The machine-readable plan is [dependency-security-remediation-plan.json](dependency-security-remediation-plan.json), governed by [dependency-security-remediation-plan.schema.json](dependency-security-remediation-plan.schema.json).

The immutable compatibility snapshot remains unchanged. Remediation must occur in future approved tasks against the maintained upstream application, with separate worktrees, reviewers, and command/path allowlists.

## Audit snapshot

The approved command `npm audit --omit=dev` was run on 2026-07-26 from three read-only targets.

| Target | Result | Observed production-dependency findings |
| --- | --- | --- |
| Governed AI OS workspace | Pass | 0 |
| Compatibility root (Next.js/IBE/Staff) | Fail | 6 high |
| Compatibility Astro storefront | Fail | 6 high, 1 low |

The compatibility root currently resolves Next.js 16.2.9, PostCSS 8.5.15, and Sharp 0.34.5. Its audit identifies high-severity Next.js request-handling findings, PostCSS source-map disclosure, Sharp/libvips issues, and brace-expansion denial-of-service paths.

The storefront currently resolves Astro 5.18.2. Its audit proposes a breaking Astro 7.1.3 update and also identifies affected esbuild, fast-uri, js-yaml, PostCSS, Sharp, and SVGO paths. That proposed version is evidence from this audit run, not a durable version recommendation; the future implementation task must refresh the audit and official migration guidance.

Audit totals are time-sensitive registry observations. They do not replace reachability analysis, and non-reachability does not silently convert a finding into a pass.

## Ordered remediation

1. Create separately approved upstream implementation packets. Refresh audits, dependency paths, runtime exposure, and patched-version availability before editing.
2. Remediate the Next.js/OpenNext/Cloudflare chain. Update the manifest and lockfile atomically, then test Server Actions, rewrites, cache behavior, image handling, internal function exposure, and middleware/proxy behavior.
3. Execute an explicit Astro major migration. Test all advisory-relevant rendering paths, SVG optimization, images, YAML resource bounds, rendered bilingual routes, metadata, and booking handoffs.
4. Require independent security and compatibility review. Only a separate release task may request staging or production deployment.

Do not run `npm audit fix --force` as a remediation strategy. A force fix can cross major versions and change the dependency graph without proving application compatibility. Overrides are acceptable only when the owning dependency cannot yet be upgraded and the future packet includes scope, expiry, compatibility evidence, and independent approval.

## Deterministic release gates

A future remediation pull request is not ready when any of these conditions applies:

- A refreshed production audit reports a critical or high finding without an approved, expiring risk exception.
- The audit command cannot complete; this is `blocked`, never `pass`.
- The manifest and lockfile disagree or were not reviewed together.
- A required local build, typecheck, lint, test, Cloudflare dry run, Astro check, or security regression fails.
- A major update lacks migration and compatibility evidence.
- A secret is detected or a protected path changes.
- The remediation reaches payments, inventory, bookings, migrations, RLS, credentials, staging, or production. Split and escalate that work into an appropriately reviewed task.

The complete gate commands and failure-state contract are machine-readable in the plan. Commands listed there describe future task requirements; they are not authorized by this Tier 0 planning packet.

## Risk acceptance

The implementation executor cannot approve an audit exception. Any exception must name the advisory and affected path, establish reachability and business impact, document compensating controls, identify an approving owner and independent security reviewer, and include an expiry date plus follow-up task.

## Rollback

Future dependency work must keep each application manifest and lockfile atomic. Revert the remediation commit or pull request as one unit, restore both files together, rerun the prior known-good local checks, and preserve all audit and verification evidence. This plan authorizes no production rollback or other live action.
