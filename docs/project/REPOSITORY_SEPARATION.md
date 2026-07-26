# AI OS Repository Separation

**Created:** 2026-07-26 (ICT)  
**AI OS repository:** `C:\Users\Bruno Browny\Documents\SUT_AI_OS`  
**Finalized platform repository:** `C:\Users\Bruno Browny\Documents\sriuthongstaging_cloned`

## Decision

The AI Operating System is an add-on developed in an independent Git repository. The finalized IBE, Astro storefront, and Staff application remain untouched while awaiting live deployment.

The finalized application is available inside this repository only as a read-only compatibility snapshot under `reference/finalized-platform/`. AI OS code must integrate through documented contracts, APIs, events, or separately approved adapters rather than by modifying the snapshot.

## Baseline provenance

| Item | Value |
| --- | --- |
| Source commit | `dbce321f61144b50a94bd11a068fa5897b0f2293` |
| Source tree | `1568e8941f95c8d5962af1e097a96e2dfdde7031` |
| Export method | Git tracked-file archive |
| Exported file count | 406 |
| Snapshot location | `reference/finalized-platform/` |
| Git history relationship | None; this repository has independent history |
| Remote | None configured |

## Exclusions

The compatibility export excludes:

- the source `.git` directory and remote configuration
- `.env.local` and other ignored local secret files
- `node_modules`
- `.next`, `.open-next`, Astro output, and other generated build directories
- `.wrangler` local state
- Playwright reports and test results
- the untracked source file `SUT Logo.png`

Tracked environment examples remain in the snapshot because they are part of the source commit and contain templates rather than live credentials. A redacted secret-shaped-string review found only short placeholders, test fixtures, and refund identifiers.

## Ongoing boundary

1. The finalized repository stays on `main` and remains a release candidate for live deployment.
2. AI OS work occurs only in this repository unless a separate integration task explicitly authorizes a finalized-platform change.
3. Canonical architecture sources remain unchanged under `docs/architecture/source/`.
4. Baseline updates must identify a new finalized commit and verify the complete tracked-file snapshot; files must never be manually patched in place.
5. No remote should be configured or pushed until ownership, repository name, visibility, and protection settings are approved.
