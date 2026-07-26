# Context management

Context is a bounded, role-specific working set—not a second source of truth. Builders include only the task packet, relevant instructions, exact evidence references, and file names in the task's allowlist. Canonical architecture documents are linked, never copied into a task context.

## Practical limits

These byte limits fit the repository's 512 KiB Codex launcher ceiling while leaving room for role instructions and prompts:

| Material | Recommended maximum | Rule |
| --- | ---: | --- |
| Task packet | 16 KiB | Keep objectives, boundaries, checks, and references concise. |
| Context pack | 128 KiB | Include only relevant files; use links for canonical sources. |
| Evidence summary | 32 KiB | Keep conclusions and references; retain raw payloads as artifacts. |
| Handoff | 16 KiB | Always include files changed, tests run, facts, interpretation, risks, and remaining budget. |
| Raw-log excerpt | 8 KiB | Preserve exact error/stack lines; keep the original artifact authoritative. |

## Builders

```text
node scripts/context/build-task-context --task SUT-AIOS-AREA-001
node scripts/context/build-review-context --task SUT-AIOS-AREA-001
node scripts/context/build-handoff --task SUT-AIOS-AREA-001 --from codex-engineering-executor --to qa-verification --summary "Bounded implementation ready" --tests "npm run verify:fast"
node scripts/context/summarize-artifact --artifact artifacts/test-results/run.log
node scripts/context/summarize-artifact --artifact artifacts/test-results/run.log --unverified
node scripts/context/check-context-size --path tasks/active/SUT-AIOS-AREA-001/context
```

`--unverified` marks Qwen/local-model preprocessing explicitly. Such text never becomes evidence or authority without deterministic and independent verification. Exact failures and stack traces are retained in summaries when needed, while large originals remain under `artifacts/`.

## Role boundaries

Start a fresh Codex session at implementer, reviewer, remediator, and orchestrator boundaries. Reviewer context is built independently from the task packet, final diff, checks, and evidence; it must not carry implementer conversational assumptions. Every handoff records remaining context budget and unresolved decisions.
