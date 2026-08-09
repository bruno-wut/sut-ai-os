# Issues, Blockers, and Risks Register

### 2026-08-01 - GOV-056 atomic MVP superseded by staged Foundation rollout

- **Task ID:** `SUT-AIOS-GOV-056`
- **Status:** Revision-required; prior verification superseded
- **Severity:** High
- **Affected scope:** The unmerged atomic Workflow V2 MVP and its proposed reconciliation/validator-registry activation.
- **Confirmed defects:** Reconciliation push recursively triggers another reconciliation run and is not idempotent; validator parity allows required validators to be registered but disabled; deterministic sorting is claimed without an assertion; a task `allowedPaths` entry conflicts with `forbiddenPaths` for `tasks/verified`; and existing evidence does not cover the reconciliation commit's second workflow invocation.
- **Decision:** Proceed only with the bounded Workflow V2 Foundation task `SUT-AIOS-GOV-056-FND`. Keep reconciliation and declarative validator-registry activation as separate follow-up tasks; do not enable either in the Foundation PR.
- **Evidence:** `evidence/tasks/SUT-AIOS-GOV-056/verification-superseded.md`
- **Next action / owner:** Chief Orchestrator to obtain independent review of the exact Foundation diff before preparing its draft PR.

### 2026-08-01 - GOV-056 Foundation exact-head safety findings resolved

- **Task ID:** `SUT-AIOS-GOV-056-FND`
- **Status:** Resolved in the unmerged Foundation branch; final exact-head review required
- **Severity:** High
- **Affected scope:** Foundation launcher, task packet allowlist, and review SHA handling
- **Findings:** The Foundation packet initially omitted the changed risk-register path; Qwen-local allowed a workspace-write request despite its read-only policy; and Git SHA resolution could return a zero placeholder when Git failed.
- **Resolution:** Added the risk-register path to the packet allowlist; rejected Qwen-local workspace-write; required successful `rev-parse`, 40-hex validation, and commit-object verification; added deterministic negative tests.
- **Evidence:** `evidence/tasks/SUT-AIOS-GOV-056-FND/verification.md`
- **Next action / owner:** Independent Terra and Sol review of the exact final committed head.

### 2026-08-01 - P2-007 final-head CI assurance is bounded

- **Task ID:** `SUT-AIOS-GOV-055`, `SUT-AIOS-P2-007`
- **Status:** Monitoring / ready for independent review
- **Severity:** High
- **Affected scope:** GitHub merge-candidate assurance for the static P2-007
  resource-budget contract.
- **Evidence:** GOV-055 adds one distinct fixed GitHub Actions step for the
  already admitted exact P2-007 validator immediately after repository fast
  verification. It adds no dynamic command construction, generic runner,
  interpolated path or arguments, credential, external service, deployment,
  P2-007 product change, resource-control behavior, booking action, or
  production operation.
- **Residual risk:** Passing final-head validation proves only the committed
  static resource-budget contract. It cannot establish truthful live resource
  usage, available capacity, operational workload controls, completed pause or
  requeue actions, notification delivery, or booking isolation.
- **Next action / owner:** Independent Sol QA must inspect the literal and its
  ordering, changed-path boundary, and task-specific machine evidence. The
  orchestrator must require green final-head CI that explicitly runs this step
  before P2-007 may move from verified to done.

### 2026-08-01 - P2-007 classifies declared resource observations but cannot establish live capacity facts

- **Task ID:** `SUT-AIOS-P2-007`
- **Status:** Monitoring / implementation ready for independent review
- **Severity:** High
- **Affected scope:** Future Staff OS and AI OS resource metering, workload
  controls, adapter composition, saturation handling, and booking isolation.
- **Evidence:** The static schema, canonical finite policy, private-authority
  deep module, documentation, and exact validator classify eleven dimensions,
  50/75/90/hard-limit boundaries, uncertain metering, bounded workload claims,
  and booking separation. Caller authorities cannot redirect classification;
  hostile input fails closed without throwing; all results remain
  non-authoritative.
- **Residual risk:** P2-007 cannot prove that a provider meter or account limit
  is truthful, a declared timestamp or age is current, batching/backpressure/
  retry controls operate, a requeue or alert occurred, or booking capacity is
  externally isolated. It performs no resource-control action.
- **Next action / owner:** Independent Sol QA must inspect the final authority,
  import boundary, threshold matrix, hostile-input behavior, and machine
  evidence. P5-006 must later verify trusted adapters, saturation behavior, and
  booking isolation before higher-volume activation.

### 2026-07-30 - P2-006 final-head CI assurance is bounded

- **Task ID:** `SUT-AIOS-GOV-052`, `SUT-AIOS-P2-006`
- **Status:** Monitoring / ready for independent review
- **Severity:** High
- **Affected scope:** GitHub merge-candidate assurance for the static P2-006
  data-minimisation and retention contract.
- **Evidence:** GOV-052 adds one distinct fixed GitHub Actions step for the
  already admitted exact P2-006 validator immediately after repository fast
  verification. It adds no dynamic command construction, generic runner,
  interpolated path or arguments, credential, external service, deployment,
  P2-006 product change, data access, storage, or retention operation.
- **Residual risk:** Passing final-head validation proves only the committed
  static metadata contract. It cannot prove payload minimisation, aggregation
  correctness, source-system behavior, legal retention, action due state,
  preservation by an external archive or transfer, or that any lifecycle action
  occurred.
- **Next action / owner:** Independent Sol QA must inspect the literal and its
  ordering, changed-path boundary, and task-specific machine evidence. The
  orchestrator must require green final-head CI before the stacked P2-006
  delivery is merged.

### 2026-07-30 - P2-006 classifies metadata but cannot establish lifecycle facts

- **Task ID:** `SUT-AIOS-P2-006`
- **Status:** Monitoring / implementation ready for independent review
- **Severity:** High
- **Affected scope:** Future aggregate ingestion, evidence persistence, and
  retention-lifecycle consumers.
- **Evidence:** The static schema, canonical finite policy, private-authority
  deep module, documentation, and 1,395-case exact validator implement the
  approved source-only telemetry boundary, eligible semantic taxonomy,
  workload cardinality prohibitions, protected-history rules, deterministic
  reasons, and non-authoritative results. Caller-supplied authorities cannot
  redirect classification and hostile input fails closed without throwing.
- **Residual risk:** A conforming descriptor is not proof that a payload is
  minimised, an aggregate is correct, a source retained raw telemetry, a legal
  rule permits an action, retention is due, an external archive/transfer
  preserved history, or any action ran. No duration, clock, provider, or live
  fact source exists in P2-006.
- **Next action / owner:** Independent Sol QA must inspect the finite authority,
  import boundary, hostile-input behavior, and machine evidence. P3-005 must
  later use separately approved trusted retention facts and configuration,
  fail closed when either is absent, and preserve append-only audit and
  failed-attempt history.

### 2026-07-30 - P2-006 validator admission is exact and non-product

- **Task ID:** `SUT-AIOS-GOV-051`, `SUT-AIOS-P2-006`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** Future independent machine verification of the P2-006
  data-minimisation and retention contract.
- **Evidence:** GOV-051 admits only the byte-for-byte literal
  `node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs`
  as `node` with one fixed repository-relative forward-slash path through the
  existing `shell: false` runner. Focused self-tests reject whitespace,
  arguments, chaining, redirects, substitutions, alternate and sibling paths,
  dot paths, traversal, absolute paths, and Windows separators.
- **Residual risk:** Command admission creates no product validator, schema,
  canonical policy, runtime module, data classification, minimisation or
  aggregation enforcement, retention action, deletion, archival, transfer,
  storage, queue, workflow, AI invocation, external call, or production
  behavior.
- **Next action / owner:** Independent Sol QA must verify GOV-051 before P2-006
  activation. P2-006 implementation and its own independent verification remain
  separately governed.

### 2026-07-30 - P2-006 data governance authority is designed, not implemented

- **Task ID:** `SUT-AIOS-GOV-050`, `SUT-AIOS-GOV-051`, `SUT-AIOS-P2-006`
- **Status:** Open / planned
- **Severity:** High
- **Affected scope:** Future aggregate ingestion, persistence, retention
  lifecycle composition, AI evidence, audit evidence, and workload consumers.
- **Evidence:** GOV-050 defines one closed metadata-only Draft 2020-12
  authority, one committed canonical policy, four source-only raw categories,
  twelve AI-OS-eligible semantic categories, ten artifact/retention classes,
  four intervals, six non-authoritative action candidates, protected audit and
  failed-attempt preservation, a private-authority deep module, deterministic
  failure precedence, and focused negative cases. It implements none of them.
  GOV-051 separately governs only the exact validator admission.
- **Residual risk:** Static classification cannot prove payload minimisation,
  aggregate correctness, source-system behavior, legal retention, action due
  state, archive/transfer preservation, or that a lifecycle operation did not
  occur. Caller descriptors remain untrusted metadata. No duration or legal
  rule is selected by P2-006.
- **Next action / owner:** Independently verify GOV-050, complete exact-only
  GOV-051, then implement P2-006 within its executable packet. P3-005 must use a
  separately approved retention configuration and trusted facts, fail closed
  when authority is missing, preserve append-only audit and failed-attempt
  history, and perform no real lifecycle action in its fixture-only scope.

### 2026-07-30 - P2-005 final-head CI assurance is bounded

- **Task ID:** `SUT-AIOS-GOV-049`, `SUT-AIOS-P2-005`
- **Status:** Monitoring / independently verified; final-head CI pending
- **Severity:** High
- **Affected scope:** GitHub merge-candidate assurance for the static P2-005
  infrastructure-port contract.
- **Evidence:** GOV-049 adds one distinct fixed GitHub Actions step for the
  already admitted exact P2-005 validator after repository fast verification.
  It adds no dynamic command construction, generic runner, interpolated path or
  arguments, credential, external service, deployment, P2-005 product change,
  infrastructure behavior, or production capability.
- **Residual risk:** Passing final-head validation proves only the committed
  static descriptor contract. It does not establish live authentication,
  authorization, replay state, current quota, recipient availability, booking
  isolation, dispatch permission, or production eligibility.
- **Next action / owner:** The orchestrator must commit and push the verified
  GOV-049 record, open the governed draft PR, and require passing final-head CI
  before the stacked delivery is merged.

### 2026-07-30 - P2-005 validates descriptors but cannot establish live trust

- **Task ID:** `SUT-AIOS-P2-005`
- **Status:** Monitoring / implementation ready for independent review
- **Severity:** High
- **Affected scope:** Future guest/public, Staff/control, and AI/workload
  cross-zone adapters and every consumer of provider-neutral infrastructure
  ports.
- **Evidence:** The static V1 schema, canonical policy, private-authority deep
  module, product documentation, and 235-case exact validator implement the
  finite GOV-047 contract. Caller schemas, policies, configurations, adapters,
  and dependency arguments cannot become runtime authority; malformed input,
  replay/idempotency conflicts, uncertain limits, shared boundaries, booking
  dependencies, and authority claims fail closed.
- **Residual risk:** A conforming descriptor is not proof of cryptographic
  identity, current time, replay/idempotency history, quota availability,
  process isolation, authorization, approval, or dispatch permission. A future
  recipient adapter must establish those facts independently from trusted
  services. P2-006 and P2-007 remain the separate minimisation/retention and
  numeric budget authorities.
- **Next action / owner:** Independent Sol QA must inspect the final diff and
  import boundary, rerun deterministic checks, and create task-specific machine
  evidence. Later adapter tasks must not accept network caller assertions as
  trusted evidence or make guest booking depend on Staff/AI capacity.

### 2026-07-30 - P2-005 validator admission is exact and non-product

- **Task ID:** `SUT-AIOS-GOV-048`, `SUT-AIOS-P2-005`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** Future independent machine verification of the P2-005
  infrastructure boundary and provider-neutral port contract.
- **Evidence:** GOV-048 admits only the byte-for-byte literal
  `node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs`
  as `node` with one fixed repository-relative forward-slash path through the
  existing `shell: false` runner. Focused self-tests reject whitespace,
  arguments, chaining, redirects, substitutions, alternate and sibling paths,
  dot paths, traversal, absolute paths, and Windows separators.
- **Next action / owner:** Independent Sol QA must verify GOV-048 before P2-005
  activation. This admission creates no product validator, schema, policy,
  runtime module, provider adapter, authentication, network, persistence,
  queue, workflow, deployment, authority, or production behavior.

### 2026-07-29 - P2-005 infrastructure authority is designed, not implemented

- **Task ID:** `SUT-AIOS-GOV-047`, `SUT-AIOS-GOV-048`, `SUT-AIOS-P2-005`
- **Status:** Open / planned
- **Severity:** High
- **Affected scope:** Future trust-zone descriptors, cross-zone recipient
  controls, provider-neutral ports, booking isolation, and adapter composition.
- **Evidence:** GOV-047 defines one closed Draft 2020-12 authority, one
  committed canonical policy, three distinct zones, five bounded cross-zone
  routes, thirteen provider-neutral ports, one private-authority validation
  surface, deterministic fail-closed reasons, and focused exploit cases. It
  implements none of them. A validation success is explicitly not live
  authentication, authorization, capacity reservation, or dispatch permission.
- **Next action / owner:** Independently verify GOV-047, complete the exact-only
  GOV-048 validator admission, then implement P2-005 within its executable
  packet. Later recipient adapters must establish credential, time, replay,
  idempotency, rate/quota, and isolation facts from trusted services rather than
  accept network-caller assertions.

### 2026-07-29 - P2-004 final-head CI assurance is bounded

- **Task ID:** `SUT-AIOS-GOV-046`, `SUT-AIOS-P2-004`
- **Status:** Monitoring / ready for independent review
- **Severity:** High
- **Affected scope:** GitHub merge-candidate assurance for the static P2-004
  intervention-proposal contract.
- **Evidence:** GOV-046 adds one fixed GitHub Actions step for the already
  admitted exact P2-004 validator after repository fast verification. It adds
  no dynamic command construction, generic runner, argument interpolation,
  credential, external service, product behavior, or production capability.
- **Next action / owner:** Independent Sol QA must inspect the literal and its
  ordering, verify the changed-path boundary, record machine evidence, and
  require passing final-head CI before the stacked delivery is merged.

### 2026-07-29 - P2-004 remains non-authoritative static validation

- **Task ID:** `SUT-AIOS-P2-004`
- **Status:** Monitoring / independently verified; final-head CI admission pending
- **Severity:** High
- **Affected scope:** Future consumers of the Intervention Proposal Contract V1.
- **Evidence:** The committed schema and private-authority deep module accept
  only canonically validated eligible P2-002 provenance, reject authority and
  execution claims, enforce finite outcome/capability/approval/risk/rollback
  mappings, and return total fail-closed frozen decisions. The exact admitted
  validator passes 221 focused cases. P2-004 creates no proposal generator,
  policy result, approval, workflow, persistence, capability grant, executor,
  verification result, audit record, notification, or production behavior.
- **Next action / owner:** GOV-046 must add the already admitted exact validator
  to final-head CI before delivery merge; downstream consumers must reject any
  treatment of a proposal or capability request as authorization. Later policy,
  human approval, execution, and independent verification remain separate
  governed authorities.

This is the durable repository-wide register for issues, blockers, risks, failed checks, and unresolved warnings. Add a dated entry before task handoff; do not rely on chat-only reporting.

### 2026-07-30 — P2-007 resource-budget validator admission is exact only

- **Task ID:** `SUT-AIOS-GOV-054`
- **Status:** Active
- **Severity:** High
- **Affected scope:** `scripts/verify/verify-cli.mjs`, `docs/verification/VERIFICATION_POLICY.md`, and future P2-007 verification
- **Evidence:** GOV-054 admits only the byte-for-byte literal `node tests/resource-governance/validate-resource-budget-contract-v1.mjs`, maps it to `node` with one fixed repository-relative argument through the existing `shell: false` runner, and rejects whitespace, extra arguments, shell operators, alternate/sibling/dot/traversal paths, absolute forms, and Windows separators. This governance task does not create or execute the P2-007 product validator and does not authorize metering or resource-control behavior.
- **Next action / owner:** Independent Sol QA must verify the exact mapping and evidence before P2-007 implementation can begin. Any broader command admission requires a separate approved governance task.

### 2026-07-29 — P2-004 validator admission is exact and non-product

- **Task ID:** `SUT-AIOS-GOV-045`, `SUT-AIOS-P2-004`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** Future independent machine verification of the P2-004
  intervention-proposal contract.
- **Evidence:** GOV-045 admits only the exact literal
  `node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs`
  as `node` plus one fixed forward-slash path argument through the existing
  `shell: false` runner. Focused self-tests reject whitespace, arguments,
  chaining, redirects, substitutions, alternate paths, dot paths, traversal,
  absolute paths, and Windows separators.
- **Next action / owner:** Independent Sol QA must verify GOV-045 before P2-004
  activation. The admission creates no validator, schema, proposal runtime,
  provider call, authority, execution, persistence, or production behavior.

### 2026-07-29 — P2-004 proposal authority is planned, not implemented

- **Task ID:** `SUT-AIOS-GOV-044`, `SUT-AIOS-GOV-045`, `SUT-AIOS-P2-004`
- **Status:** Open / planned
- **Severity:** High
- **Affected scope:** Future intervention-proposal schema, semantic validator,
  provenance boundary, capability requests, approval posture, and downstream
  workflow consumers.
- **Evidence:** GOV-044 defines one closed V1 schema, one private-authority
  validator, exact P2-002 provenance checks, finite outcomes/capabilities/risks,
  and explicit false authority claims. It implements none of them. GOV-045
  separately governs the exact validator admission.
- **Next action / owner:** Complete independent GOV-045 verification, then
  implement P2-004 only within its exact packet. Reject any generator, policy,
  approval, workflow, persistence, provider, executor, retention, or production
  expansion; proposals must remain non-authoritative and fail closed.

### 2026-07-29 — Infrastructure portability and resource-governance controls are planned, not implemented

- **Task ID:** `SUT-AIOS-GOV-043`
- **Status:** Open / planned
- **Severity:** High
- **Affected scope:** Future guest/public, Staff/control, AI/workload, persistence, queue/workflow, provider, runner, and evidence infrastructure.
- **Evidence:** ADR-0002 and backlog packets `P2-005`–`P2-007`, `P3-004`, and `P5-005`–`P5-006` define seams and QA rejection gates without provisioning a component.
- **Next action / owner:** Complete static authorities before Phase 3 activation, separately admit exact validators, and do not claim cross-account isolation, retention enforcement, capacity protection, or migration readiness before independent evidence exists.

### 2026-07-30 — P2-007 static observations cannot prove live capacity or workload enforcement

- **Task ID:** `SUT-AIOS-GOV-053`, `SUT-AIOS-P2-007`
- **Status:** Open / planned limitation
- **Severity:** High
- **Affected scope:** Future resource meters, provider limits, worker/queue/workflow controls, notification paths, and booking-isolation evidence.
- **Evidence:** GOV-053 fixes a provider-neutral metadata classifier with committed thresholds and ceilings. It deliberately has no clock, provider meter, queue, scheduler, workflow, notifier, process control, or booking access, so a valid observation cannot prove that its limit, usage, age, workload controls, or isolation claims match external reality.
- **Next action / owner:** GOV-054 must first admit the exact validator; P2-007 must implement and independently verify only the static authority. Runtime adapters must fail closed on uncertainty, and P5-006 must prove saturation and booking isolation before higher-volume activation.

### 2026-07-29 — GOV-043 review found no P2-001/R02 or P2-002 product remediation

- **Task ID:** `SUT-AIOS-GOV-043`, `SUT-AIOS-P2-001-R02`, `SUT-AIOS-P2-002`
- **Status:** Resolved
- **Severity:** Low
- **Affected scope:** Completed deterministic analytics and provider-neutral intelligence contract boundaries.
- **Evidence:** GOV-043 reviews only future derived portability planning. P2-001/R02 retains its standards-based schema assurance and explicit semantic ordering boundary. P2-002 retains its pinned runtime Ajv dependency, trusted provider-rejection semantics, and final-head CI validator admission. Neither contract imports new infrastructure authority or has a concrete defect from ADR-0002 planning.
- **Next action / owner:** Preserve terminal history and evidence; require a new bounded remediation task only if a concrete defect is independently demonstrated.

## Entry format

```md
### YYYY-MM-DD — Short title

- **Task ID:** `optional-task-id`
- **Status:** Open | Monitoring | Blocked | Accepted risk | Resolved
- **Severity:** Critical | High | Medium | Low
- **Affected scope:** paths, service, workflow, or environment
- **Evidence:** command output, report link, or reproducible observation
- **Next action / owner:** concrete follow-up and responsible role
```

## Open entries

### 2026-07-29 — P2-002 final-head CI assurance gap

- **Task ID:** `SUT-AIOS-GOV-042`, `SUT-AIOS-P2-002`
- **Status:** Resolved pending independent verification
- **Severity:** High
- **Affected scope:** `.github/workflows/validate-governance.yml` and the P2-002
  merge-candidate assurance boundary.
- **Evidence:** PR #84's earlier green workflow did not invoke
  `node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs`, so
  GitHub Actions did not independently prove the reviewed 236-case validator on
  the final merge candidate. GOV-042 adds exactly that explicit command after
  dependency installation and `npm run verify:fast`, without changing or
  replacing any existing CI step.
- **Next action / owner:** Independent Sol QA must inspect the bounded workflow
  diff, run the packet-authorized checks and one machine verification cycle,
  then final-head GitHub Actions must pass before either stacked PR is approved.

### 2026-07-29 — P2-002 runtime dependency and rejection provenance gaps

- **Task ID:** `SUT-AIOS-P2-002`
- **Status:** Resolved
- **Severity:** High
- **Affected scope:** P2-002 runtime authority loading, package metadata, and
  provider-result semantic validation.
- **Evidence:** External review found that the runtime contract imports Ajv
  while Ajv was declared development-only, and that a valid request could be
  paired with provider-supplied request-rejection reason codes. The earlier
  R02 risk text accurately described P2-001 but did not account for P2-002's
  later runtime import.
- **Resolution:** Ajv 8.17.1 is now a pinned runtime dependency in both package
  authorities; deterministic validation proves its complete lockfile graph is
  retained when development dependencies are omitted. After request validation
  succeeds, every provider-supplied `rejected` variant now fails closed as the
  singleton `MALFORMED_PROVIDER_RESULT`; trusted request validation remains the
  only constructor of request-level rejection decisions.
- **Next action / owner:** A separate governance task must add the exact P2-002
  validator to GitHub Actions before PR #84 is approvable. Independent Sol QA
  must verify this product remediation after that governance prerequisite.

### 2026-07-29 — P2-002 rejected-reason semantics and finite boundary coverage are incomplete

- **Task ID:** `SUT-AIOS-P2-002`
- **Status:** Resolved
- **Severity:** Medium
- **Affected scope:** P2-002 semantic result validation and deterministic
  contract validator.
- **Evidence:** Final Sol QA found that `resultSemanticsAreValid()` accepts
  precedence-ordered combinations containing `MALFORMED_PROVIDER_RESULT` or
  `INTERNAL_AUTHORITY_UNAVAILABLE`, although the approved GOV-040 design makes
  each code exclusive. The 93-case validator also omits required finite boundary
  cases, including every intervention selection, low/high confidence bands,
  text and collection edges, identifier/digest edges, and the exclusive-code
  regression. Existing validator, packet, fast, and diff checks otherwise pass.
- **Resolution:** The semantic authority now rejects any multi-code result that
  contains either fatal code. The deterministic validator covers both exclusive
  fatal-code regressions, every finite enum and result variant, and accepted and
  rejected edges for the documented text, identifier, digest, numeric, and
  collection bounds. The provider-neutral static boundary remains unchanged.
- **Next action / owner:** Resolved by final independent Sol QA. Retain
  `verification-20260729111249806.json` with the historical failed records.

### 2026-07-28 — P2-002 verification evidence path is absent from its allowlist

- **Task ID:** `SUT-AIOS-P2-002`
- **Status:** Resolved
- **Severity:** Medium
- **Affected scope:** P2-002 task metadata and independent verification evidence.
- **Evidence:** Fresh Sol QA used explicit `--base origin/main`; the machine
  record `verification-20260728164848515.json` inspected a nonempty nine-path
  delivery diff, all functional tests passed, forbidden paths remained
  untouched, and the secret scan passed. Changed-path inspection failed solely
  because the packet does not allow its required historical directory
  `evidence/verification/SUT-AIOS-P2-002/**` and therefore treats the preserved
  earlier failed record as outside scope.
- **Resolution:** The task-specific machine-evidence directory is explicitly
  allowed. Final independent verification inspected the complete nonempty
  `origin/main` diff, preserved both failed records, and passed changed-path and
  security-boundary checks in `verification-20260729111249806.json`.
- **Next action / owner:** No further P2-002 correction is required; retain the
  complete evidence history.

### 2026-07-28 — P2-002 remains a contract-only, non-authoritative boundary

- **Task ID:** `SUT-AIOS-P2-002`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** Provider-neutral request/result contracts and future
  intelligence-provider adapters.
- **Evidence:** P2-002 implements two closed schemas and a two-function semantic
  validation module only. Prepared analytics references must originate from the
  canonical P2-001/R02 boundary; P2-002 does not import or reinterpret its
  internals. Provider invocation, prompts, adapters, proposals, approval,
  execution, and production access remain absent. The deterministic validator
  passed 93 cases covering private authority, classification, cross-references,
  all provider states, self-authorization rejection, and hostile never-throw
  inputs.
- **Evidence:** Independent Sol QA passed the 93-case validator, packet and fast
  checks, and the single machine verification cycle. Because the implementation
  was committed before QA and the packet has no `worktree.primaryBranch`, the
  machine record defaulted to `HEAD` and listed no changed paths. The record was
  preserved; supplemental `verify:changed --base origin/main` and
  `verify:security-boundaries --base origin/main` runs covered all nine delivery
  and evidence paths, found no forbidden/outside path, and found no configured
  secret pattern. Two initial direct `verify-cli.mjs` diagnostic invocations
  failed on wrapper syntax before the documented npm wrapper forms passed.
- **Evidence:** Final independent Sol QA passed the expanded 236-case validator
  and machine verification against the complete nonempty `origin/main` diff in
  `verification-20260729111249806.json`.
- **Next action / owner:** Future provider tasks must preserve the deep-module
  and hexagonal boundary and must not treat analysis as authorization.

### 2026-07-28 — P2-002 validator admission remains exact and fail-closed

- **Task ID:** `SUT-AIOS-GOV-041`, `SUT-AIOS-P2-002`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** Future
  `tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs`
  independent machine verification and the safe required-command parser.
- **Evidence:** GOV-040 fixes the future command byte for byte. GOV-041 adds
  only that exact literal, maps it to `node` with one fixed repository-relative
  path argument through the existing `shell: false` runner, and rejects focused
  whitespace, argument, operator, redirect, substitution, alternate-path,
  dot-path, traversal, and Windows-separator near misses. This governance task
  does not create or execute the P2-002 validator or introduce intelligence
  schemas, contract logic, provider invocation, proposals, workflows, execution,
  live data access, or production behavior.
- **Next action / owner:** Independent Sol QA must verify GOV-041 before P2-002
  can move to ready. Retain exact-command admission and machine evidence for the
  later product task; any command expansion requires a separate approved packet.

### 2026-07-28 — P2-001 schema assurance gaps require independent remediation review

- **Task ID:** `SUT-AIOS-P2-001-R02`
- **Status:** Monitoring
- **Severity:** Medium
- **Affected scope:** P2-001 request/result authorities, deterministic validator,
  and downstream analytics or intelligence consumers.
- **Evidence:** Post-completion review found that the original validator manually
  inspected selected schema properties without standards-based Draft 2020-12
  compilation and that the schema did not explain the runtime-only lexical
  ordering rule for correlation identifiers. R02 now pins Ajv 8.17.1 as a
  development-only validator, compiles both committed authorities, exercises
  canonical request decisions, validates every generated result against exactly
  one declared variant, rejects focused malformed results, and proves unsorted
  identifiers are structurally schema-valid but return `INVALID_CONTEXT` from
  the calculator. The admitted validator and all fast checks pass locally.
- **Next action / owner:** Independent Sol QA must review the final R02 diff and
  run the single machine verification cycle before downstream P2-002 work.

### 2026-07-28 — R02 install reports one moderate Ajv advisory

- **Task ID:** `SUT-AIOS-P2-001-R02`
- **Status:** Monitoring
- **Severity:** Low
- **Affected scope:** Original P2-001 use of the root dependency and later
  P2-002 runtime use.
- **Evidence:** Installing pinned `ajv@8.17.1` completed successfully and reported
  one moderate npm advisory. Ajv remains absent from the pure P2-001 analytics
  runtime, but P2-002 later imports it to compile committed request/result
  authorities and therefore correctly promotes the pinned version to a runtime
  dependency. It receives only committed repository schemas and introduces no
  production capability. No audit fix or version expansion was attempted.
- **Next action / owner:** Monitor the pinned runtime dependency; any upgrade or
  advisory remediation requires a separately approved dependency task.

### 2026-07-28 — P2-001 must remain a local deterministic measurement boundary

- **Task ID:** `SUT-AIOS-GOV-038`, `SUT-AIOS-GOV-039`, `SUT-AIOS-P2-001`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** Future P2-001 schemas, calculator core, validator, and
  downstream intelligence input.
- **Evidence:** GOV-038 fixes a pure, stable `calculateMetricComparison`
  boundary with no infrastructure imports, no live data, and fail-closed
  invalid/non-comparable results. Correlation and seasonality are context or
  not evaluated, never causal inference. GOV-039 adds only the exact shell-free
  verifier mapping for the planned validator and focused near-miss rejection
  coverage; it does not implement or execute the validator. Fresh independent QA on 2026-07-28
  found the revised design still ambiguous about valid result-number bounds and
  its six-decimal rounding algorithm, and did not provide a total mapping from
  malformed field shapes to ordered reason-code combinations. Machine
  verification was therefore not run. A later correction fixed the declared
  output bounds and rounding rule, but final fresh QA found nested
  period/context structural failures, IEEE-754 accumulation order, and the
  boundary between result-field overflow checks and internal mean/rate
  accumulators still under-specified. The final bounded correction now maps
  those nested structural failures to `MALFORMED_REQUEST`, fixes supplied-order
  left-to-right ECMAScript Number accumulation, and restricts declared numeric
  bounds to raw and rounded externally returned fields while requiring private
  accumulators to remain finite. Fresh independent Sol QA accepted the corrected
  plan and released it for machine verification; the earlier failed reviews
  remain recorded above.
- **Next action / owner:** Independently verify GOV-039, then implement only the
  approved V1 contract after the admission is merged. Sol QA must verify core/adapter
  separation, human approval boundaries, CI/evidence, and rollback before any
  downstream intelligence use.

### 2026-07-28 — P1-008 Staff OS validator admission remains exact and fail-closed

- **Task ID:** `SUT-AIOS-GOV-036`, `SUT-AIOS-GOV-037`, `SUT-AIOS-P1-008`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** Future `tests/staff-os/validate-observe-only-control-views-v1.mjs` independent machine verification and the safe required-command parser.
- **Evidence:** GOV-036 defines the byte-for-byte future command `node tests/staff-os/validate-observe-only-control-views-v1.mjs`. GOV-037 admits only that literal, maps it to `node` with one fixed repository-relative path argument through the existing `shell: false` runner, and self-tests reject whitespace, argument, chaining, operator, redirect, substitution, alternate, sibling, dot-path, traversal, and backslash variants. Independent Sol QA passed once at `evidence/verification/SUT-AIOS-GOV-037/verification-20260728115053566.json`. The product validator remains absent and was not executed by this governance task; the planned P1-008 view set remains static Tier 0 contract metadata only and is not a live Staff OS control surface.
- **Next action / owner:** Retain the exact admission and machine evidence for P1-008 implementation. P1-008 cannot become verified until its own independent machine verification passes. Any further test-path admission requires a separate approved governance task.

### 2026-07-28 — P1-007 validator admission remains exact and fail-closed

- **Task ID:** `SUT-AIOS-GOV-035`, `SUT-AIOS-P1-007`
- **Status:** Resolved
- **Severity:** High
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and future P1-007 machine verification.
- **Evidence:** GOV-035 admits only the byte-for-byte literal `node tests/orchestrator/validate-kill-switch-controls-v1.mjs`, maps it to `node` with one fixed path argument and `shell: false`, and self-tests reject whitespace, argument, alternate-path, sibling-path, and shell-operator variants. Independent Sol QA passed once at `evidence/verification/SUT-AIOS-GOV-035/verification-20260728111144993.json`. The product validator does not yet exist and was not executed by this governance task.
- **Next action / owner:** Retain the exact admission and machine evidence for P1-007 implementation. Any future test-path admission requires a separate approved governance task.

### 2026-07-28 — P1-006 validator admission remains exact and fail-closed

- **Task ID:** `SUT-AIOS-GOV-034`, `SUT-AIOS-P1-006`
- **Status:** Resolved
- **Severity:** High
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and future P1-006 machine verification.
- **Evidence:** GOV-034 admits only the byte-for-byte literal `node tests/playbooks/validate-playbook-registry-v1.mjs`, maps it to `node` with one fixed path argument and `shell: false`, and self-tests reject whitespace, argument, alternate-path, sibling-path, and shell-operator variants. Independent QA passed once at `evidence/verification/SUT-AIOS-GOV-034/verification-20260728101336615.json`. The product validator does not yet exist and was not executed by this governance task.
- **Next action / owner:** Retain the exact admission and machine evidence for P1-006 implementation. Any future test-path admission requires a separate approved governance task.

### 2026-07-28 — Suffixed planning task identity was truncated by governance CI

- **Task ID:** `SUT-AIOS-GOV-033`, `SUT-AIOS-P1-006-PLAN`
- **Status:** Resolved
- **Severity:** High
- **Affected scope:** `scripts/github/validate-governance.mjs` branch-to-task identity binding and PR #50 verification lookup.
- **Evidence:** PR #50 used the exact planning identity `SUT-AIOS-P1-006-PLAN`, but the former branch parser truncated it to `SUT-AIOS-P1-006` and searched the wrong machine-evidence directory. GOV-033 now resolves only exact repository task IDs, selects the longest exact identity, and self-tests unsuffixed and suffixed branches plus unknown, doubled, punctuated, overlength, and additional-suffix near misses. Independent QA and machine verification passed at `evidence/verification/SUT-AIOS-GOV-033/verification-20260728095821799.json`.
- **Next action / owner:** Merge GOV-033, then rebase PR #50 so CI binds it to `SUT-AIOS-P1-006-PLAN` and its retained evidence.

### 2026-07-28 — Mac Mini and subscription-backed provider operational risks

- **Task ID:** `SUT-AIOS-GOV-032`
- **Status:** Open
- **Severity:** High
- **Affected scope:** Future `IntelligenceProvider`, Pi-to-Codex adapter, Mac
  Mini host, co-located Pi durable orchestration, supervised worker, Codex
  repository adapter, isolated workspaces, and audit evidence.
- **Evidence:** The derived decision
  `docs/decisions/ADR-0001-MAC-MINI-PI-CODEX-RUNTIME.md` identifies unresolved
  subscription-session persistence and terms, uncertain usage-limit/capacity
  signals, authentication renewal, worker sleep/reboot/network and
  single-point-of-failure behavior, concurrency/timeouts, workspace cleanup, and
  audit-data privacy. No provider or worker runtime is implemented by GOV-032.
- **Next action / owner:** Engineering Planner must preserve these as acceptance
  and negative-test requirements in `P4-005`, `P4-006`, `P5-002`, and `P5-004`.
  Sol and independent QA must verify fail-closed provider-state behavior before
  any runtime activation.

### 2026-07-28 — P1-005 shared JSON authority mutation bypass

- **Task ID:** `SUT-AIOS-P1-005-R01`
- **Status:** Resolved
- **Severity:** Critical
- **Affected scope:** `packages/policy-engine/src/evaluator.mjs`, the V1 validator isolation boundary, and focused evaluator regressions.
- **Evidence:** Independent QA reproduced the bypass at `e605162`, then verified remediation evidence at `evidence/verification/SUT-AIOS-P1-005-R01/verification-20260728072304032.json`: private parsed/frozen V2 authority resists shared-module mutation and production-write relabelling; V1 validation is self-contained; meaningful dependency and malformed-input regressions deny fail-closed. PR #48 merged in `170be25`, and its final-head Governance / validate run `30338285897` succeeded.
- **Next action / owner:** Retain the remediation evidence; no further action for this bounded risk.

### 2026-07-28 — P1-005 policy evaluator engine hardening and assurance reconciliation

- **Task ID:** `SUT-AIOS-P1-005`, `SUT-AIOS-GOV-027`
- **Status:** Resolved
- **Severity:** High — Governance, assurance integrity, and security semantics
- **Affected scope:** `packages/policy-engine/src/evaluator.mjs`, `packages/policy-engine/src/json-schema-evaluator.mjs`, `schemas/evaluation-context.schema.json`, `schemas/evaluation-decision.schema.json`, `policies/deterministic-authorization-policies-v2.json`, `tests/policy-engine/validate-deterministic-policy-evaluator.mjs`, and `.github/workflows/validate-governance.yml`.
- **Evidence:** Delivered via GOV-027 in PR #42 with 100% green GitHub Actions CI (`Governance / validate` pass in 7s):
  1. Extracted shared Draft 2020-12 schema evaluator at `packages/policy-engine/src/json-schema-evaluator.mjs`.
  2. Created closed context and decision schemas (`schemas/evaluation-context.schema.json` and `schemas/evaluation-decision.schema.json`).
  3. Created `policies/deterministic-authorization-policies-v2.json` with explicit policy bounds.
  4. Closed policy-mutation relabeling exploit and enforced principal/resource authorization bounds in `evaluator.mjs`.
  5. Expanded test suite to 56 systematic mutation tests.
  6. Added explicit CI workflow step running `node tests/policy-engine/validate-deterministic-policy-evaluator.mjs`.
  7. Recorded superseding reconciliation evidence at `evidence/tasks/SUT-AIOS-P1-005/reconciliation.md`.
  8. PR #42 merged to `origin/main` at commit `715b142`.
- **Next action / owner:** Retain verification evidence `evidence/verification/SUT-AIOS-GOV-027/verification-20260727170641293.json`.



### 2026-07-27 — P1-004 policy verification trust chain and contract schema remediation

- **Task ID:** `SUT-AIOS-P1-004`, `SUT-AIOS-GOV-023`, `SUT-AIOS-GOV-030`
- **Status:** Resolved
- **Severity:** High — Governance, assurance integrity, and contract isolation
- **Affected scope:** `policies/deterministic-authorization-policies-v1.json`, `tests/policy-definitions/validate-authorization-policies-v1.mjs`, `schemas/authorization-policy-contract-v1.schema.json`, `docs/policy-definitions/DETERMINISTIC_AUTHORIZATION_POLICIES.md`.


- **Evidence:** Remediation delivered via GOV-023 in PR #36 with 100% green GitHub Actions CI (`Governance / validate` pass):
  1. Formal JSON schema authority created at `schemas/authorization-policy-contract.schema.json`.
  2. Taxonomy & title clarified to `Static Authorization Policy Taxonomy and Defaults Contract`.
  3. Non-discretionary safety boundaries and contextual requirements defined for `platform_read_only`.
  4. Validator upgraded to execute 108 exhaustive negative and mutation tests.
  5. PR #36 merged to `origin/main` at commit `c995dd7` after green CI pass (`Governance / validate` pass in 8s).
- **Next action / owner:** Retain verification evidence `evidence/verification/SUT-AIOS-GOV-023/verification-20260727155856029.json`.



### 2026-07-27 - P1-002 machine-verifier command admission is resolved

- **Task ID:** `SUT-AIOS-GOV-018`
- **Status:** Resolved
- **Severity:** Medium
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and P1-002 machine verification
- **Evidence:** GOV-017 defines P1-002's exact validator command as `node tests/control-plane-schema/validate-control-plane-schema.mjs`. GOV-018 delivered its separate byte-for-byte mapping with fixed Node arguments, `shell: false`, dedicated rejection coverage, and passing independent machine verification at `evidence/verification/SUT-AIOS-GOV-018/verification-20260726184458346.json`.
- **Next action / owner:** Retain the evidence. Any future test-path admission requires a separately approved governance task; do not weaken the generic test-path parser.

### 2026-07-27 - P1-003 machine-verifier command admission is not yet authorized

- **Task ID:** `SUT-AIOS-GOV-019`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and P1-003 machine verification
- **Evidence:** GOV-019 defines P1-003's exact future validator command as `node tests/audit/validate-append-only-audit-contract.mjs`; the current verifier admits only separately reviewed literal test paths and has no audit-contract mapping.
- **Next action / owner:** After GOV-019 is independently reviewed and delivered, create a separate reviewed governance task that admits only this byte-for-byte command with fixed Node arguments, `shell: false`, and rejection coverage. Do not weaken the generic test-path parser.

### 2026-07-27 - Terminal task completion accepts a nonexistent supplemental evidence path

- **Task ID:** `SUT-AIOS-GOV-016`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `scripts/task/complete` terminal-record evidence validation
- **Evidence:** GOV-016's terminal `completionEvidence` includes `evidence/verification/SUT-AIOS-GOV-016/verification-20260726174004908.json`, which does not exist. Valid passing machine verification remains at `evidence/verification/SUT-AIOS-GOV-016/verification-20260726173952633.json`, and the valid durable task record is `evidence/tasks/SUT-AIOS-GOV-016/verification.md`.
- **Next action / owner:** Create a separate, independently reviewed lifecycle-tool remediation that validates every supplied completion-evidence path before allowing a terminal transition. Do not manually alter the immutable GOV-016 record.

### 2026-07-27 - P1-001 validator admission remains exact and fail-closed

- **Task ID:** `SUT-AIOS-GOV-016`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and P1-001 machine verification
- **Evidence:** GOV-016 admits only the byte-for-byte literal `node tests/event-contracts/validate-normalized-system-event-contract.mjs`, maps it to `node` with one fixed argument and `shell: false`, and self-tests reject whitespace, argument, alternate-path, and shell-operator variants.
- **Next action / owner:** QA Verification must independently verify GOV-016 before P1-001 implementation begins. Any further test-path admission requires a separate approved governance task.

### 2026-07-27 - Normalized event payload semantics remain intentionally deferred

- **Task ID:** `SUT-AIOS-GOV-015`
- **Status:** Monitoring
- **Severity:** Low
- **Affected scope:** `docs/event-contracts/NORMALIZED_SYSTEM_EVENT_CONTRACT.md` and future event consumers
- **Evidence:** Version 1 requires a closed envelope but permits an object-valued `payload` with open internal fields. This preserves a stable common boundary while avoiding invented domain schemas before control-plane and audit tasks are approved.
- **Next action / owner:** Downstream domain-contract tasks must define and independently verify payload semantics before relying on payload fields for authorization, retention, routing, delivery, or personal-data handling.

### 2026-07-26 — Machine verifier admits only flag-only Node task commands

- **Task ID:** `SUT-AIOS-GOV-013`
- **Status:** Monitoring
- **Severity:** Low
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and task-packet test declarations
- **Evidence:** The parser fail-closed on `node scripts/task/validate --task <id>` because it permits only `--flag` arguments. `node scripts/task/validate --all` is safely admitted and validates the same packets for GOV-013.
- **Next action / owner:** Use the all-packet form for machine verification unless a separately approved verifier-parser task expands the safe grammar with full rejection coverage.

### 2026-07-26 — Compatibility baseline dependency audit findings

- **Task ID:** `workspace-bootstrap`
- **Status:** Open
- **Severity:** High
- **Affected scope:** `reference/finalized-platform/` root Next.js application and `website/astro-site/`
- **Evidence:** `npm ci` reported 7 high-severity findings for the root application; the Astro storefront reported 1 low- and 6 high-severity findings. See [compatibility build validation](../verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md).
- **Next action / owner:** Run a history-aware dependency/security review under a separately approved task. Do not update the immutable baseline in place.

### 2026-07-26 — Existing lint baseline is red

- **Task ID:** `workspace-bootstrap`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** finalized-platform compatibility baseline
- **Evidence:** Historical audit records 6 ESLint errors and 1 warning in guest layout, application layout, cookie banner, and cookie-consent code. See [workspace audit](WORKSPACE_AUDIT.md).
- **Next action / owner:** Create a scoped, independently verified compatibility or upstream-maintenance task before treating lint as a required autonomous gate.

### 2026-07-26 — Build warnings require design review

- **Task ID:** `workspace-bootstrap`
- **Status:** Monitoring
- **Severity:** Medium
- **Affected scope:** Next.js IBE/Staff and Astro storefront compatibility baseline
- **Evidence:** Root build reports middleware deprecation, Edge Runtime Node API use, and missing no-secret validation settings. Astro build reports the missing news-content directory and static rendering use of request headers. See [compatibility build validation](../verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md).
- **Next action / owner:** Review under separate, scoped tasks; do not alter the immutable reference snapshot.

### 2026-07-26 — Shell automation prerequisites unavailable

- **Task ID:** `workspace-bootstrap`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** Codex-led repository execution and PR governance
- **Evidence:** Historical audit found GitHub CLI unavailable and the shell-invoked Codex CLI inaccessible on this workstation. See [workspace audit](WORKSPACE_AUDIT.md).
- **Next action / owner:** Obtain approved GitHub CLI/GitHub App and a working, scoped Codex execution environment before enabling automated PR or executor workflows.

### 2026-07-26 — Disposable validation output remains outside the repository

- **Task ID:** `workspace-bootstrap`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** local system temporary directory only
- **Evidence:** The isolated compatibility validation copy remains at `C:\Users\Bruno Browny\AppData\Local\Temp\sut-ai-os-validation-dbce321-20260726` after the environment safety layer declined recursive cleanup. It contains generated dependencies and build output only.
- **Next action / owner:** Remove the validated temporary directory through an approved local cleanup action; no repository files are affected.

### 2026-07-26 — Agent schema contracts are identifiers only

- **Task ID:** `SUT-AIOS-GOV-001`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `agents/**` logical input/output schema URNs and future agent runtime activation
- **Evidence:** All 15 definitions declare stable input/output schema URNs, but `schemas/` does not yet contain their machine-readable JSON or Zod implementations.
- **Next action / owner:** Engineering Planner and QA should define and independently validate shared envelope/result contracts before any agent runtime or dispatcher is provisioned.

### 2026-07-26 — Agent registry awaits independent specialist review

- **Task ID:** `SUT-AIOS-GOV-001`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** Agent registry production readiness and any future runtime activation
- **Evidence:** Deterministic structural and permission-boundary checks can be completed locally, but no separate reviewer has yet approved the definitions, routing, handoffs, or permission matrix.
- **Next action / owner:** Assign an independent assurance/security reviewer; record the review in `evidence/tasks/SUT-AIOS-GOV-001/verification.md` before treating the registry as verified or provisioning tools/credentials.

### 2026-07-26 — Installed Codex CLI alias is not shell-executable

- **Task ID:** `SUT-AIOS-GOV-002`
- **Status:** Blocked
- **Severity:** High
- **Affected scope:** Live Sol/Terra/Luna wrapper execution and installed CLI/catalog validation
- **Evidence:** `Get-Command codex` resolves the installed Windows app alias, but `codex --version` and `codex --help` both fail before output with `Access is denied`. See `evidence/tasks/SUT-AIOS-GOV-002/verification.md`.
- **Next action / owner:** Workspace owner should repair/install an accessible Codex CLI or app execution alias, then run the documented live validation sequence before enabling wrappers beyond dry-run.

### 2026-07-26 — Local Qwen runtime is unavailable

- **Task ID:** `SUT-AIOS-GOV-002`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** `qwen-local` offline preprocessing route
- **Evidence:** Neither Ollama nor the LM Studio CLI is installed/detected. The wrapper and isolation policy are structurally validated only.
- **Next action / owner:** Select an approved local provider and Qwen model, verify local-only/no-egress operation, then add a Qwen-specific task packet and independent privacy/security test.

### 2026-07-26 — Model-routing wrappers await independent review

- **Task ID:** `SUT-AIOS-GOV-002`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** Unattended Codex workspace-write execution
- **Evidence:** Deterministic syntax, dry-run, route, rejection, context, trace, and secret-pattern tests pass, but no separate reviewer has approved the subprocess, environment, permission, and context-boundary design.
- **Next action / owner:** Assign independent assurance/security review and record it in `evidence/tasks/SUT-AIOS-GOV-002/verification.md` before unattended workspace-write use.

### 2026-07-26 â€” Task-packet control system awaits independent assurance review

- **Task ID:** `SUT-AIOS-GOV-003`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** `tasks/`, `schemas/`, `scripts/task/`, and canonical JSON packet use in `scripts/codex/launch.mjs`
- **Evidence:** JSON parsing, lifecycle self-test, active-packet validation, canonical JSON dry run, and model-routing regression tests pass. See `evidence/tasks/SUT-AIOS-GOV-003/verification.md`.
- **Next action / owner:** QA and Verification Agent should independently inspect state transitions, execution-readiness checks, terminal immutability, schema/tool parity, and launcher compatibility before this system becomes completion authority for implementation tasks.

### 2026-07-26 â€” Artifact retention backend is not yet implemented

- **Task ID:** `SUT-AIOS-GOV-003`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** Raw log, screenshot, and trace retention for task evidence
- **Evidence:** The task workflow requires large payloads to be stored under `artifacts/` and referenced from packets, but no retention, access-control, hashing service, or CI uploader exists yet.
- **Next action / owner:** Add a separately reviewed artifact/evidence retention design before high-volume or sensitive operational evidence is collected.

### 2026-07-26 â€” Worktree removal automation awaits independent review

- **Task ID:** `SUT-AIOS-GOV-004`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** `scripts/worktree/` and task packet worktree metadata
- **Evidence:** The manager is designed to fail closed for dirty, conflicted, unpushed, and unmerged worktrees, but no independent reviewer has exercised it against shared developer worktrees or diverse Git versions.
- **Next action / owner:** QA and Verification Agent should independently review the manager and its disposable Git fixture before removal automation is used outside isolated local tasks.

### 2026-07-26 â€” Application-level verification remains unavailable in the governance workspace

- **Task ID:** `SUT-AIOS-GOV-005`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** Content schema, Astro/storefront, Next.js/IBE, Staff OS, webhook replay, preview smoke, Lighthouse, and migration verification
- **Evidence:** The command inventory found runnable scripts only in `reference/finalized-platform/`, which is immutable. `verify:content`, `verify:storefront`, `verify:ibe`, and `verify:staff-os` therefore return explicit blocked results.
- **Next action / owner:** Create approved implementation-worktree tasks that install dependencies locally and bind each detected application command to a no-side-effect verification profile.

### 2026-07-26 â€” Context summarizer requires independent semantic review

- **Task ID:** `SUT-AIOS-GOV-006`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** `scripts/context/summarize-artifact` and generated summaries under `artifacts/reports/`
- **Evidence:** The summarizer preserves exact error/failure lines and labels Qwen/local preprocessing as unverified, but it does not establish semantic truth about an artifact.
- **Next action / owner:** QA and Verification Agent must review summaries before they influence decisions, code, public content, or completion evidence.

### 2026-07-26 â€” No approved local Qwen runtime or model is installed

- **Task ID:** `SUT-AIOS-GOV-007`
- **Status:** Blocked
- **Severity:** High
- **Affected scope:** `scripts/local-ai/`, Qwen preprocessing, and Qwen/Luna/Terra benchmark execution
- **Evidence:** Windows audit found no Ollama, LM Studio CLI, llama.cpp, vLLM, llamafile, or Qwen model file. No model ID was guessed and no download was attempted. See `docs/model-routing/QWEN_SETUP.md`.
- **Next action / owner:** Workspace owner must select one approved runtime and one exact hardware-appropriate Qwen model/quantization, then perform a local-only privacy and deterministic-validation review before enabling execution.

### 2026-07-26 — GitHub identity and authority are unconfirmed

- **Task ID:** `SUT-AIOS-GOV-008`
- **Status:** Open / awaiting separately approved governance configuration
- **Severity:** High
- **Affected scope:** Remote, branch protection, rulesets, CODEOWNERS activation, staging and production environments
- **Evidence:** GitHub CLI `2.96.0` is authenticated as `bruno-wut` with admin permission on `bruno-wut/sut-ai-os`. `origin` now points to the target and `chore/codex-workspace-bootstrap` is pushed. The remote still has no protection rulesets or environments.
- **Next action / owner:** Workspace owner must separately approve any default-branch decision, branch protection, ruleset, environment, or pull-request action.

### 2026-07-26 — Independent review pending for GitHub governance

- **Task ID:** `SUT-AIOS-GOV-008`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `.github/`, `scripts/github/`, CI policy enforcement
- **Evidence:** Local validation is implemented; an independent QA agent has not yet reviewed the final diff and evidence.
- **Next action / owner:** QA and Verification Agent must run the governance checks and record a machine-readable result before any pull request is considered verified.

### 2026-07-26 — Model telemetry starts without historical provider usage

- **Task ID:** `SUT-AIOS-GOV-009`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** `artifacts/reports/model-runs/` and model-routing evaluation
- **Evidence:** Existing Codex/local wrappers intentionally do not retain token counts, prompts, or outputs. Initial aggregate reports are therefore empty until new sanitized run records are supplied.
- **Next action / owner:** Engineering and QA should record comparable, independently verified runs for each evaluation class before treating routing metrics as directional.

### 2026-07-26 — Documented task move command is not exposed through npm

- **Task ID:** `SUT-AIOS-GOV-009`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** Task packet lifecycle ergonomics
- **Evidence:** `npm run task:move` is documented but absent from `package.json`; `node scripts/task/move` remains available and was used for this packet.
- **Next action / owner:** Add and independently verify the missing package command in a separate governance task.

### 2026-07-26 — Telemetry verification initially blocked by a non-allowlisted command form

- **Task ID:** `SUT-AIOS-GOV-009`
- **Status:** Resolved; failed evidence retained
- **Severity:** Low
- **Affected scope:** Task-packet required-test compatibility with the independent verifier
- **Evidence:** `verification-20260726124741943.json` recorded a blocked result because `verify:task` deliberately permits only safe direct script commands and the packet used an npm indirection for task validation.
- **Next action / owner:** Packet now uses `node scripts/task/validate --all`; QA must rerun independent verification before task completion.

### 2026-07-26 — Future subsystem test commands require refinement at task start

- **Task ID:** `SUT-AIOS-GOV-010`
- **Status:** Monitoring
- **Severity:** Low
- **Affected scope:** Phase 1–8 backlog packets
- **Evidence:** Packets name intended subsystem tests such as `test:event-contracts` and `test:workflow`; those package commands do not exist until their subsystem scaffold is approved and created.
- **Next action / owner:** Engineering Planner must confirm each command against the real package manifest before moving that packet to `ready`; unavailable or invented commands block execution.

### 2026-07-26 — P0-003 contract-validator verification admission is exact only

- **Task ID:** `SUT-AIOS-GOV-014`
- **Status:** Resolved pending independent verification
- **Severity:** High
- **Affected scope:** `verify:task` required-command parser for P0-003 compatibility verification
- **Evidence:** P0-003's deterministic command is `node tests/compatibility/validate-finalized-platform-contracts.mjs`. GOV-014 maps only that byte-for-byte literal to `node` with one fixed argument and `shell: false`. Self-tests reject whitespace and argument variants, alternate paths, and shell-operator forms; generic `node tests/...` execution remains unsupported.
- **Next action / owner:** QA Verification must run the packet-authorized independent machine verification and retain its result before GOV-014 is marked verified. Any further test-path admission requires a separate approved governance task.

### 2026-07-26 — Workspace readiness review limitations

- **Task ID:** `SUT-AIOS-GOV-011`
- **Status:** Open / monitored
- **Severity:** High until runtime prerequisites exist
- **Affected scope:** Live Codex execution, Qwen preprocessing, application verification, and protected GitHub operation
- **Evidence:** `WORKSPACE_READINESS_REPORT.md` records an inaccessible Codex executable alias, no approved local Qwen runtime/model, application suites available only in the immutable baseline, unresolved agent schema URNs, and absent remote protection/environments.
- **Next action / owner:** Workspace owner and Engineering Planner must resolve each prerequisite through separate approved task packets. None may be inferred as production authorization.

### 2026-07-26 — Backlog permissions and governance enforcement defects

- **Task ID:** `SUT-AIOS-GOV-011`
- **Status:** Resolved and independently verified
- **Severity:** High
- **Affected scope:** Product backlog routing, independent review, task transitions, CI diff enforcement, and telemetry totals
- **Evidence:** The readiness review corrected non-executor implementation routes, duplicate controls, owner/reviewer identity, stale packet context paths, pull-request diff discovery, detached-checkout branch discovery, and cached-token double counting.
- **Next action / owner:** Retain `evidence/verification/SUT-AIOS-GOV-011/verification-20260726130854628.json` with this task and monitor the pushed GitHub workflow separately.

### 2026-07-26 — Production dependency audit command admitted safely across platforms

- **Task ID:** `SUT-AIOS-P0-002`, remediated by `SUT-AIOS-GOV-012`
- **Status:** Resolved
- **Severity:** High
- **Affected scope:** `verify:task` safe required-command parsing and CI evidence for production-dependency audits
- **Evidence:** Two independent P0-002 verifier runs, `verification-20260726152717886.json` and `verification-20260726152741451.json` on branch `task/SUT-AIOS-P0-002-plan-dependency-and-security-remediation`, recorded `blocked` even though a direct packet-authorized `npm audit --omit=dev` passed with exit `0`. The parser rejected the required command before execution. GOV-012's first bare-`npm` Windows mapping failed in `verification-20260726155555816.json`; its `npm.cmd` revision also failed shell-free execution in `verification-20260726160006575.json`, while direct packet-authorized audits passed. The final bounded revision uses `process.execPath` to execute the existing bundled npm CLI JavaScript path on Windows, checks that path before launch, retains `shell: false`, and fixes the remaining arguments to `audit`, `--omit=dev`. Deterministic self-tests cover platform mappings, missing-CLI blocking, unchanged rejection forms, and actual child success, nonzero, and execution-error outcomes. Independent verification in `evidence/verification/SUT-AIOS-GOV-012/verification-20260726160516462.json` passed the real audit, self-test, packet validation, fast governance, changed-path, and secret-boundary checks.
- **Next action / owner:** Retain the historical blocked/failed evidence and the final independent pass. Any future expansion beyond the exact literal `npm audit --omit=dev` requires a separate approved governance task and independent review.
