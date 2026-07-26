# Context Index

Read `AGENTS.md` first for every task. Then use the shortest path below; open canonical sources only when the listed documents do not settle the question.

| Task category | Minimum reading path |
| --- | --- |
| Task creation, lifecycle, or packet validation | [TASK_WORKFLOW.md](TASK_WORKFLOW.md) -> task packet -> [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md) -> relevant evidence template |
| Worktree creation or cleanup | [WORKTREE_WORKFLOW.md](WORKTREE_WORKFLOW.md) -> ready task packet -> [TASK_WORKFLOW.md](TASK_WORKFLOW.md) -> [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md) |
| Verification or acceptance review | [VERIFICATION_POLICY.md](../verification/VERIFICATION_POLICY.md) -> task packet -> [ACCEPTANCE_MATRIX.md](../verification/ACCEPTANCE_MATRIX.md) -> [TEST_OWNERSHIP.md](../verification/TEST_OWNERSHIP.md) |
| Workspace orientation | [PRODUCT.md](PRODUCT.md) → [CURRENT_STATE.md](CURRENT_STATE.md) → [SYSTEM_MAP.md](SYSTEM_MAP.md) |
| Ordinary implementation | [CURRENT_STATE.md](CURRENT_STATE.md) → task packet → [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) → relevant interface in `reference/finalized-platform/` |
| Bounded discovery or preparation | task packet → [GLOSSARY.md](GLOSSARY.md) → [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) |
| Architecture or repository shape | [SYSTEM_MAP.md](SYSTEM_MAP.md) → [ROADMAP.md](ROADMAP.md) → canonical architecture source |
| Agent, prompt, model, or executor design | [`MODEL_ROUTING_POLICY.md`](../model-routing/MODEL_ROUTING_POLICY.md) → [`agents/REGISTRY.md`](../../agents/REGISTRY.md) → [`agents/PERMISSION_MATRIX.md`](../../agents/PERMISSION_MATRIX.md) → [AUTONOMY_BOUNDARIES.md](AUTONOMY_BOUNDARIES.md) → canonical agent architecture source |
| Security, privacy, payment, concurrency, RLS, or difficult escalation | [AUTONOMY_BOUNDARIES.md](AUTONOMY_BOUNDARIES.md) → [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md) → [KNOWN_RISKS.md](KNOWN_RISKS.md) → canonical source |
| Compatibility or integration planning | [CURRENT_STATE.md](CURRENT_STATE.md) → [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md) → specific read-only baseline files → validation record |
| Verification or handoff | task packet → [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) → [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md) → relevant evidence |
| Policy or playbook change | [AUTONOMY_BOUNDARIES.md](AUTONOMY_BOUNDARIES.md) → [ENGINEERING_PRINCIPLES.md](ENGINEERING_PRINCIPLES.md) → canonical sources |
| Incident or blocker | [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md) → [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md) → task evidence or runbook |

The canonical documents are detailed authority, not routine context. Read them for consequential design, ambiguity, policy conflict, or any task touching protected domains.
