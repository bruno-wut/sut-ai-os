# SUT-AIOS-P3-001 V1-to-V2 migration record

- **Task:** `SUT-AIOS-P3-001`
- **Migration:** legacy V1 backlog packet migrated in place to Task Packet V2
- **Canonical base:** `origin/main` at `76f42c6b0d7a292fb1bb251c088c6e3e9db0f6ce`
- **Pre-migration V1 packet blob:** `58d1b75a1bbdc0e467323b2534f5d67d80fcda9b`
- **V2 packet:** `tasks/backlog/SUT-AIOS-P3-001/task.json`

The V1 packet remains available as immutable Git history at the recorded blob
SHA. The active packet now uses `schemaVersion: "2.0.0"` and stage-specific
`routingPolicy` for implementation, plan review, semantic review, and merge-risk
review. It must pass V2 validation and the configured review stages before it
can enter `ready` or `active`.

The migration preserves the original P3-001 objective and boundaries. It adds
only the V2 governance envelope and the exact `package.json` entry point needed
to run the packet-required signal-ingestion validator; dependencies, production
behavior, providers, persistence, deployment, payments, inventory, pricing,
and guest-data behavior remain out of scope.
