# Dependency Graph

```mermaid
flowchart LR
  A["P1 audit/policy foundation"] --> B["P2-002 intelligence contracts"]
  B --> C["P2-004 proposal contract"]
  A --> TZ["P2-005 trust zones and ports"]
  TZ --> DM["P2-006 minimisation and retention"]
  TZ --> QB["P2-007 resource budgets"]
  DM --> I["P3-001 ingestion"]
  QB --> I
  I --> Q["P3-002 queue/workload controls"]
  DM --> Q
  QB --> Q
  TZ --> P["P3-004 persistence composition"]
  DM --> P
  QB --> P
  P --> RL["P3-005 retention lifecycle fixtures"]
  DM --> RL
  QB --> RL
  Q --> W["P3-003 workflow"]
  C --> W
  QB --> W
  W --> G["P4-004 intelligence gateway"]
  TZ --> G
  DM --> G
  QB --> G
  G --> C1["P4-005 Pi-to-Codex adapter"] --> M["P4-006 Mac Mini worker"]
  Q --> M
  P --> M
  QB --> M
  M --> RE["P4-007 Codex repository adapter"] --> D["P4-002 dispatcher"] --> X["P4-003 PR flow"]
  X --> V["P5-001 independent verification"] --> E["P5-002 evidence"]
  P --> MR["P5-005 migration readiness"]
  RL --> MR
  Q --> MR
  M --> MR
  E --> MR
  QB --> SV["P5-006 quota/saturation verification"]
  Q --> SV
  W --> SV
  M --> SV
  V --> SV
```

## Dependency rules

- Dependencies are satisfied only at `verified` or `done` with durable evidence.
- `P2-005`, `P2-006`, and `P2-007` are Phase 3 prerequisites; runtime work may
  not invent trust, retention, or quota authorities.
- All infrastructure behavior enters core through stable ports; adapters own
  provider SDKs/configuration. Provider replacement must not rewrite core.
- Ingestion is aggregate-oriented, bounded, deduplicated, idempotent, and
  backpressured. Non-available capacity fails closed to pause/requeue/DLQ.
- Staff/AI exposure is authenticated; cross-account traffic uses audience-bound
  short-lived HTTPS credentials, recipient expiry/audience checks,
  timestamp/nonce replay rejection, idempotency, bounded bodies/timeouts, and
  per-caller/per-route rate limits. Guest booking paths have distinct
  credentials, quotas, deployments, and failure boundaries.
- Missing, unavailable, stale, inconsistent, uncertain, or unknown metering
  fails closed; it may not be estimated into a booking-impacting decision.
- `P5-005`/`P5-006` are evidence gates, not deployment or migration authority.

The graph is acyclic. See `IMPLEMENTATION_BACKLOG.md` for direct dependencies.
