# SUT-AIOS-GOV-032 local implementation evidence

## Outcome

The bounded roadmap implementation is ready for independent Sol QA. It records a
derived provider-neutral Mac Mini/Pi/Codex deployment decision, reconciles
permanent Phase 0–8 roadmap memory, revises only future Phase 2–5 packets, and
adds six future backlog packets. It implements no runtime or production
capability.

## Changed artifacts

- Added `docs/decisions/ADR-0001-MAC-MINI-PI-CODEX-RUNTIME.md`.
- Updated provider, autonomy, roadmap, dependency, milestone, vertical-slice,
  current-state/focus, and risk memory under `docs/model-routing/` and
  `docs/project/`.
- Revised future backlog packets `P2-002`, `P2-003`, `P3-002`, `P3-003`,
  `P4-002`, `P4-003`, `P4-005`, `P4-006`, `P5-001`, and `P5-002`.
- Added future backlog packets `P2-004`, `P4-004`, `P4-005`, `P4-006`, and
  `P5-004`; the bounded remediation added `P4-007` for the distinct Codex
  repository ExecutorAdapter.
- Updated only the `SUT-AIOS-GOV-032` lifecycle record and evidence.

## Architecture and dependency review

- The first path is a 24/7 Mac Mini host running the Pi orchestration service
  and its durable queue/workflow state → supervised worker → Codex CLI adapter
  → Codex CLI with ChatGPT subscription authentication. These components are
  co-located but remain logically separate.
- `IntelligenceProvider`, `ProposalGenerator`, `ExecutorAdapter`, and
  `VerificationProvider` are provider-neutral.
- Codex is not the scheduler, workflow engine, policy engine, authorization
  authority, or audit source of truth.
- `P4-007` separately bounds the Codex repository ExecutorAdapter to analysis,
  code/content changes, approved tests, branch/PR preparation, and repair
  preparation at Tier 0. Provider transport and dispatcher tasks do not absorb
  that authority.
- Pi queue/workflow records survive Pi-service, worker-process, and device
  restarts and are never Codex process, session, output, or workspace state.
- The provider states are exactly `available`, `busy`, `rate_limited`,
  `capacity_exhausted`, `authentication_required`, `temporarily_unavailable`,
  and `disabled`; every non-`available` state fails closed to pause or safe
  requeue with evidence and appropriate notification.
- AI cannot authorize its own intervention proposal. New work remains Tier
  0/shadow and cannot perform production changes.
- Manual edge review confirmed the recalculated Phase 2–5 graph is acyclic:
  intelligence precedes proposals; durable workflow precedes the gateway;
  gateway precedes the Codex adapter; adapter precedes the worker and repository
  adapter; worker, repository adapter, and gateway precede executor dispatch;
  execution precedes independent
  verification and evidence; fallback qualification is last.
- `P1-006`, completed/verified records, other active task history, immutable
  architecture sources, runtime code, schemas, policies, scripts, CI, packages,
  and the finalized-platform snapshot were not changed.

## Local deterministic checks

| Command | Result |
| --- | --- |
| `node scripts/task/validate --all` | Pass; all packets, including five new backlog packets and GOV-032, are valid. |
| `npm run verify:fast` | Pass; packet validation, routing validation, worktree self-test, and lifecycle self-test passed. |
| `node scripts/github/validate-governance.mjs` | Pass; branch/task match, path boundaries, secret scan, schemas, policies, and agent definitions passed. |
| `git diff --check` | Pass. |

Independent QA and the single authorized `verify:task` run are intentionally
pending. The implementer has not claimed completion authority.

## PR #51 CI root cause and remediation

The first PR #51 governance run had no machine-readable result under
`evidence/verification/SUT-AIOS-GOV-032/`. CI therefore could not bind the
review claim to an independent `verify:task` artifact. This was an evidence
sequencing failure, not a local deterministic-check failure; no passing machine
result was fabricated.

The task returned through `revision-required` to `active`. This remediation
amends the packet, adds the missing distinct `P4-007` repository executor,
corrects the co-located Pi/Mac Mini durability model, reruns the local
packet-authorized checks, and returns the packet to review. Independent Sol QA
must inspect the final diff and perform the single authorized `verify:task` run
to create the machine result before the branch is treated as verified.

## Assumptions and unresolved risks

- Pi denotes the logical orchestration service running initially on the same Mac
  Mini host; the roadmap does not require separate Raspberry Pi hardware.
- Subscription terms, unattended authentication/session persistence, and
  machine-readable usage/capacity signals require implementation-time
  verification.
- Mac Mini sleep, reboot, network, storage, and single-point-of-failure behavior
  require supervision and durable Pi state outside worker/Codex ephemeral state,
  with restart recovery on the same host.
- Workspace collision, concurrency, timeout, disk, retention, cleanup, and audit
  privacy requirements remain future bounded implementation work.
- No fallback provider is enabled by this roadmap.

## Rollback

Revert only the GOV-032 ADR, permitted permanent-memory edits, revised/new future
backlog packets, GOV-032 state, and this evidence. Preserve all completed/current
task history, P1-006, immutable sources, runtime surfaces, and historical
evidence.
