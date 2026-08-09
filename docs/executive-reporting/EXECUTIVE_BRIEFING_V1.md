# Executive Briefing V1

`services/executive-briefing/src/generate-executive-briefing-v1.mjs` provides
the Tier-0, observe-only composition function:

```text
generateExecutiveBriefing(input) -> frozen { ok, value, rejection }
```

It is a deterministic local view over already governed inputs. It does not
generate an AI response, contact a provider, fetch a record, persist a
briefing, schedule delivery, notify a recipient, evaluate policy, record an
approval, authorize a capability, execute an intervention, or claim
verification or production eligibility.

## Accepted records

The closed briefing input contains `schemaVersion`, `briefingId`,
`briefingPeriod`, and bounded `metrics`, `intelligence`, and `proposals`
arrays. It contains no endpoint, recipient, credential, provider selection,
storage location, command, approval state, or executable action.

- Each metric is `{request, result}`. The module re-runs the public
  P2-001 `calculateMetricComparison(request)` function and accepts the pair
  only when its deterministic result exactly matches the supplied result.
  P2-001's bounded numeric prepared-observation port has no guest, booking,
  payment, inventory, or pricing identity fields.
- Each intelligence record is `{request, result}` and is revalidated through
  P2-002's public `validateIntelligenceRequest` and
  `validateIntelligenceResult` functions. Its committed request contract
  accepts only `public` or `internal` prepared evidence classifications.
- Each proposal is `{proposal, intelligenceRequest, intelligenceResult}` and
  is revalidated through P2-004's public
  `validateInterventionProposal` function. That public authority fixes every
  accepted proposal as non-authoritative and not approved, authorized,
  executed, independently verified, or production eligible.

The briefing adds no replacement schema or caller-selectable authority. It
also rejects closed-input violations and named raw guest/per-event telemetry
keys before composition. Contract validation cannot establish that an external
source truthfully aggregated data; later trusted ingestion work must establish
that fact. It can establish that this V1 boundary neither accepts raw fields
nor treats caller claims as action authority.

## Output contract

A successful `value` is closed by construction and contains:

- fixed `schemaVersion: "1.0.0"`, `mode: "observe-only"`,
  `nonAuthoritative: true`, `productionWritePermission: false`, and
  `actionAuthority: "none"`;
- snapshots of the revalidated deterministic metrics, structured intelligence,
  and governed intervention proposals; and
- `pendingApprovalProposalIds` plus an ordered `reasonCodes` limitation list.

`status` is `complete` only when all three source categories are present and
none reports a bounded limitation; otherwise it is `limited`. A limited
briefing remains a valid observation, not a permission or failure bypass.

| Observed condition | Briefing reason code | Effect |
| --- | --- | --- |
| No metric/intelligence/proposal record | `NO_VALIDATED_METRICS`, `NO_STRUCTURED_INTELLIGENCE`, or `NO_GOVERNED_PROPOSALS` | Missing evidence is visible; no substitute is invented. |
| Non-comparable or insufficient metric confidence | `METRIC_CONFIDENCE_INSUFFICIENT` | The raw values remain a bounded observation only. |
| P2-002 insufficient evidence | `INSUFFICIENT_EVIDENCE` | No conclusion or authority is inferred. |
| P2-002 provider unavailable | `PROVIDER_UNAVAILABLE` | Unavailability is reported; no fallback call is made. |
| P2-004 human review requirement | `APPROVAL_REQUIRED` | Proposal IDs remain pending; nothing is approved or executed. |

Rejected input returns a frozen fail-closed rejection with exactly one of
`MALFORMED_BRIEFING_REQUEST`, `UNSUPPORTED_SCHEMA_VERSION`,
`RAW_TELEMETRY_REJECTED`, `INVALID_DETERMINISTIC_METRIC`,
`INVALID_STRUCTURED_INTELLIGENCE`, or `INVALID_INTERVENTION_PROPOSAL`.
Hostile values such as accessors, proxies, cycles, symbols, functions, bigint,
non-finite numbers, and non-plain objects do not throw through the public API.

Run the exact local contract check with:

```text
npm run test:briefing
```

Rollback removes only the executive-briefing service, validator,
documentation, and P2-003 implementation evidence. It preserves P2-001,
P2-002, P2-004, and all protected architecture and compatibility authorities.
