# Verification policy

Verification is independent only when a verifier identity and model are recorded separately from the task packet owner. An implementation agent cannot self-verify. Verified work remains implementation plus deterministic checks plus independent review plus recorded evidence.

## Available commands

- `verify:fast` runs only local governance checks detected in this repository: task packet validation, Codex-routing self-tests, worktree fixture, and task lifecycle fixture.
- `verify:changed` performs deterministic changed-path collection; `verify:security-boundaries` scans changed readable files for configured secret patterns without printing values.
- `verify:task` loads a canonical task packet, checks the final diff against allowed/forbidden paths, runs its safe required-test commands, records independent verifier identity/model, and writes JSON evidence below `evidence/verification/<task-id>/`.
- `verify:full` combines the available local checks and explicitly lists unavailable capabilities.

`verify:content`, `verify:storefront`, `verify:ibe`, and `verify:staff-os` currently return `blocked`: their detected commands belong to the immutable compatibility baseline or no independently runnable subsystem exists. They must be enabled only from an approved implementation worktree; the verification framework never builds in `reference/finalized-platform/`.

## Task verification

```text
npm run verify:task -- --task SUT-AIOS-AREA-001 --verifier-agent qa-verification --verifier-model gpt-5.6-terra --acceptance-confirmed
```

Without `--acceptance-confirmed`, semantic acceptance criteria remain `pending` and the result is `revision_required`; a tool cannot infer business acceptance. A failed required test yields `fail`; an unsafe/unavailable required command or self-verification yields `blocked`. In all non-pass cases, `productionEligible` is false. It is also false unless the task explicitly grants production-write permission.

Large logs, traces, screenshots, and reports belong in `artifacts/`; result JSON stores concise references only. Do not add secrets or raw webhook payloads to evidence.
