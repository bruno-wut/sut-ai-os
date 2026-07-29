# Engineering Principles

## Deep modules, ports, and fail-closed infrastructure

Future Phase 2+ code exposes small stable core ports and hides provider details
in adapters. Core/domain logic must not import infrastructure SDKs. Unknown
authority, malformed input, unsupported configuration, unavailable dependency,
or resource saturation fails closed. Guest booking and Staff/AI workloads retain
distinct trust, credential, quota, deployment, and failure boundaries; see
ADR-0002.

1. Measure deterministically before asking a model to explain a change.
2. Prefer narrow, reversible, observable changes over broad repairs.
3. Separate planning, authorization, execution, and verification.
4. Treat models as bounded collaborators, never as the policy engine or source of truth.
5. Preserve immutable references and avoid speculative application reorganization.
6. Design for auditability: inputs, decisions, commands, outputs, evidence, and outcomes must be reconstructable.
7. Protect guest data, payment state, inventory, and financial decisions through least privilege and human gates.
8. Escalate uncertainty rather than hiding it behind confident language.
9. **Security & Governance Task Assurance**: Security and governance tasks are not complete when their files look correct. They are complete only when the intended security meaning is explicit, the implementation is checked against an independent authority, negative cases are systematically tested, and evidence is bound to an exact commit and authenticated review. Before implementation, classify the task (design contract, runtime capability, or governance control), define precise scope, non-goals, security semantics, and authoritative source of truth. The task-specific validator must execute the authoritative contract, systematically reject invalid mutations, run explicitly in CI, and produce evidence bound to the exact reviewed commit.


## Model routing

| Model | Default use | Boundary |
| --- | --- | --- |
| Terra | Ordinary implementation default: bounded code, docs, tests, and task execution | Must still obey packet, policy, verification, and independent review |
| Luna | Bounded discovery, repository inventory, summarization, classification, and routine preparation | Does not authorize changes or establish facts without verification |
| Sol | Architecture, security, payment, concurrency, RLS, and difficult escalation | Advises and reviews; does not bypass approval or deterministic policy |
| Local Qwen | Offline preprocessing, redaction support, extraction, and low-sensitivity classification | Untrusted; output is not evidence and requires independent verification before use |

Model selection is a routing decision, not permission. Data classification, task risk, and policy always override convenience or model capability.
