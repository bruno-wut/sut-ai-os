# Bootstrap Changelog

This file records every workspace-level change made during the Codex workspace bootstrap on 2026-07-26 (ICT).

## Branch change

- Created and switched from `main` to `chore/codex-workspace-bootstrap` at commit `dbce321f61144b50a94bd11a068fa5897b0f2293`.
- The requested branch name was available; no timestamped fallback was needed.
- The pre-existing untracked `SUT Logo.png` remained in place and was not modified, staged, renamed, or deleted.

## Directories created

- `docs/architecture/source/`
- `docs/project/`

## Files created

| File | Purpose | Integrity |
| --- | --- | --- |
| `docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md` | Canonical product and platform architecture source | Byte-for-byte copy; SHA-256 `F3C0F4C493C45BC2E0D412D9D63DDD6E1866DAE29BA75F26CD4DA41DBF8845A6` |
| `docs/architecture/source/Agent Architecture.md` | Canonical agent architecture source | Byte-for-byte copy; SHA-256 `3FF1F651C35E86CD89FE258D410976170C8D27679B4EB1E28A74EFC60DCB3D94` |
| `docs/project/WORKSPACE_AUDIT.md` | Repository, stack, commands, test, CI, environment, risk, prerequisite, and architecture-gap audit | Authored during bootstrap |
| `docs/project/BOOTSTRAP_CHANGELOG.md` | Durable record of bootstrap workspace changes | Authored during bootstrap |

Source locations for the canonical copies:

- `C:\Users\Bruno Browny\Documents\AI OS SUT\docs\architecture\Sri U-Thong Grand Hotel AI OS.md`
- `C:\Users\Bruno Browny\Documents\AI OS SUT\docs\architecture\Agent Architecture.md`

## Verification performed

- Confirmed `main` matched `origin/main` before branch creation.
- Confirmed only one worktree existed.
- Confirmed the canonical-copy destination paths did not exist before copying.
- Verified each copied architecture document against its source with SHA-256.
- Ran `npm ls --depth=0 --omit=optional` at the root and for `website/astro-site`; installed dependencies resolved successfully.
- Ran `npm run typecheck`; passed.
- Ran `npm test`; 28 files and 117 tests passed.
- Ran `npm run lint`; baseline failed with 6 errors and 1 warning. No lint fixes were made in this bootstrap.
- Rechecked Git status after verification; tests created no visible tracked or untracked output.

## Explicitly unchanged

- No application source, test, migration, package manifest, lockfile, environment file, Cloudflare configuration, Supabase configuration, or existing documentation was edited.
- No dependency was installed, removed, or updated.
- No files were staged, committed, pushed, reset, cleaned, overwritten, or deleted.
- No build, E2E suite, database test, migration, remote verification, preview, deployment, production query, secret operation, DNS operation, payment operation, or Cloudflare production action was run.
- The separate empty repository at `C:\Users\Bruno Browny\Documents\SUT_AI_OS` was not changed.

## Independent repository separation

After the original audit, the project direction was clarified: the finalized IBE, Astro storefront, and Staff application must remain untouched, and the AI OS must be developed as an independent add-on.

The following separation changes were made:

- Used the previously empty `C:\Users\Bruno Browny\Documents\SUT_AI_OS` Git repository as the independent AI OS workspace.
- Exported the 406 files tracked by finalized-platform commit `dbce321f61144b50a94bd11a068fa5897b0f2293` into `reference/finalized-platform/` without Git metadata, ignored secrets, dependencies, build output, local Cloudflare state, or test artifacts.
- Added root repository boundaries and byte-preservation rules in `AGENTS.md`, `.gitignore`, `.gitattributes`, and `README.md`.
- Added `reference/README.md` and `docs/project/REPOSITORY_SEPARATION.md` for provenance and maintenance rules.
- Relocated the four original bootstrap documents into this repository. The two canonical architecture source files remain byte-for-byte unchanged.
- Returned the finalized platform workspace to `main`; its pre-existing untracked `SUT Logo.png` remains untouched.
- Did not configure or push a remote for the AI OS repository.
- Reused the finalized repository's existing `Developer <dev@sriuthonghotels.com>` identity as repository-local Git author configuration; no global Git configuration was changed.
