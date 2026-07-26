# Repository Agent Boundary

This repository is the independent development workspace for the Sri U-Thong Grand Hotel AI OS add-on.

## Immutable compatibility baseline

`reference/finalized-platform/**` is read-only.

Agents may inspect, search, type-analyze, or compare files in that directory. Agents must not edit, format, rename, move, delete, generate files into, install dependencies into, build inside, or commit changes under that path.

The snapshot represents source commit `dbce321f61144b50a94bd11a068fa5897b0f2293`. Integration work must adapt to its existing contracts without modifying the snapshot or the source repository.

## Canonical sources

Files under `docs/architecture/source/**` are canonical source documents and must remain content-identical to their originals. Derived plans, ADRs, and implementation notes belong elsewhere under `docs/`.

## Safety defaults

- Treat `C:\Users\Bruno Browny\Documents\sriuthongstaging_cloned` as read-only unless the user separately and explicitly authorizes a change there.
- Do not deploy, push, alter DNS, mutate Cloudflare production state, run production database migrations, modify RLS, change payment configuration, or access guest data without explicit task-specific authorization.
- Never copy `.env.local`, `.dev.vars`, credentials, generated output, dependency directories, or test artifacts from the finalized workspace.
- Prefer deterministic checks before model reasoning and require independent verification for code changes.
- Preserve unrelated user work and stop if a requested change would cross the repository boundary.

## Development placement

New AI OS implementation belongs outside `reference/`, following the canonical architecture. Do not reorganize or duplicate the finalized application into active development paths without an approved architecture decision.
