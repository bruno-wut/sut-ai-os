# Dependency Graph

The critical path to the first complete execution slice is:

```mermaid
flowchart LR
  P0["P0-001 Clean baseline"] --> C["P0-003 Compatibility contracts"]
  C --> E["P1-001 Event contract"] --> S["P1-002 Control-plane schema"] --> A["P1-003 Audit records"]
  A --> P["P1-004 Policies"] --> PE["P1-005 Policy engine"]
  P --> R["P1-006 Playbook registry"]
  PE --> K["P1-007 Kill switches"]
  R --> K
  K --> W["P3-003 Durable workflow"]
  W --> D["P4-002 Codex dispatcher"] --> X["P4-003 Executor/PR flow"]
  X --> Q["P5-001 Independent QA"] --> V["P5-002 Preview evidence"]
  P --> CSR["P6-004 Content-schema repair"]
  R --> CSR
  K --> CSR
  X --> CSR
  V --> CSR
```

## Dependency rules

- A dependency is satisfied only when its packet is `verified` or `done` with durable evidence.
- Schema and policy dependencies precede runtime implementation.
- Audit and kill-switch controls precede autonomous execution.
- Codex execution precedes independent QA integration; independent QA precedes the first vertical slice.
- Phase labels describe product sequencing, but branches may proceed in parallel only when their packet dependencies are satisfied.
- Payment, authentication, authorization, RLS, workflow correctness, rollback, and autonomy work always retain Sol escalation.

No cycle exists in the generated graph. Phase 6 content-schema repair intentionally depends on Phase 1, Phase 4, and Phase 5 foundations rather than the broader SEO ingestion path.
