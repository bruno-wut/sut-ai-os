# Script Guidance

## Subsystem purpose

`scripts/` contains reusable local helpers for Codex execution, task lifecycle, worktrees, verification, local AI preprocessing, and context assembly. Scripts are support tooling, not production services.

## Important entry points

- `scripts/codex/` — Codex workspace helpers.
- `scripts/task/` — task-packet lifecycle helpers.
- `scripts/worktree/` — isolated-worktree helpers.
- `scripts/verify/` — deterministic verification helpers.
- `scripts/local-ai/` — offline/private-model preprocessing.
- `scripts/context/` — context assembly and masking.

## Commands

- Inspect scripts with `rg --files scripts`.
- Check changes with `git diff --check`.
- Run the script's documented help, fixture, dry-run, or unit command from the approved task packet; no shared script runner exists yet.

## Local conventions

- Prefer explicit paths, deterministic inputs, idempotence, dry-run modes, and useful non-zero failures.
- Keep external side effects opt-in and visibly separated from read-only inspection.
- Never rely on ambient credentials or broad directory globs.
- Mask sensitive values before writing logs, context bundles, or evidence.

## Allowed modifications

Change scripts only when the approved task packet allowlists the exact script path and command surface. New scripts require a usage note, safety review, and deterministic test or fixture.

## Sensitive files

Worktree, verification, local-AI, and context helpers can expose paths, data, or execution authority. Treat them as security-sensitive and keep generated output outside tracked source files.

## Prohibited actions

- Do not deploy, mutate production systems, alter databases, change DNS, or contact payment systems from a default script path.
- Do not run unrestricted SQL, read or print secrets, or write credentials into logs or generated context.
- Do not silently delete user work or bypass task, review, or verification controls.

## Required tests

Run syntax/type checks where applicable, fixture or dry-run tests, path-boundary checks, and a no-external-side-effects review. Use the packet's command allowlist as the authority.

## Expected evidence

Record commands, inputs or fixture identifiers, outputs, changed paths, side-effect assessment, independent review, and any warnings in the task evidence destination.

## Escalation triggers

Escalate scripts that need credentials, network writes, production access, destructive filesystem operations, unrestricted SQL, new subprocess authority, or changes to shared verification/control logic.
