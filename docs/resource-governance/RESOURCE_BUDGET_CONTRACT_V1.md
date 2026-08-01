# Resource budget contract V1

## Purpose and authority

P2-007 is a static Tier-0 classifier for one declared Staff OS or AI OS
resource observation. The structural authority is
`schemas/resource-budget-contract-v1.schema.json`; the finite policy authority
is `policies/resource-budget-policy-v1.json`. The only runtime interface is:

```js
evaluateResourceBudget(observation)
```

The module loads those committed authorities internally. Callers cannot supply
schemas, policies, thresholds, validators, adapters, configuration, clocks, or
provider clients. Extra function arguments are ignored and recognizable
authority fields in the observation are rejected. Results are recursively
frozen plain data; malformed, cyclic, accessor-backed, proxied, or otherwise
hostile input never throws and fails closed.

## Finite classification

V1 covers eleven dimensions: Worker requests and CPU, queue operations,
workflow steps, persistence size/growth/egress, runner minutes, AI invocations
and tokens, and notification messages. Each dimension has one canonical unit.
The observation supplies safe non-negative integer used and reserved units and
a positive safe-integer hard limit. These are untrusted declared facts, not
provider proof.

Usage is calculated with integer arithmetic as
`floor((used + reserved) * 10000 / hardLimit)`. The thresholds are:

| Basis points | State | Non-authoritative outcome |
| --- | --- | --- |
| `< 5000` | `below_warning` | `continue_candidate` |
| `5000..7499` | `warning_50` | `warn_continue_candidate` |
| `7500..8999` | `warning_75` | `throttle_candidate` |
| `9000..9999` | `warning_90` | `requeue_candidate` only when bounded retry is safe; otherwise `pause_candidate` |
| `10000` | `hard_limit_reached` | `block_candidate` |
| `> 10000` | `hard_limit_exceeded` | `block_candidate` |

Displayed use is capped at `10001` to distinguish exactly-at-limit from
over-limit without floating-point drift. Warning-90 and hard-limit results are
fail closed. Every result is non-authoritative and grants no scheduling,
execution, notification, production-write, capacity-reservation, or booking
authority.

## Fail-closed boundaries

Threshold classification requires all of the following:

- available budget authority and valid configuration;
- a `fresh` meter with complete bounded integer measurements, a canonical UTC
  timestamp, and declared age no greater than 300 seconds. Calendar validity,
  including month lengths and leap days, is evaluator-enforced semantic
  validation beyond Draft 2020-12 pattern support;
- the `staff_control` or `ai_workload` zone, isolated from booking quotas,
  credentials, deployments, and failure boundaries;
- bounded batch or governed-summary work with deduplication, idempotency,
  backpressure, rate/concurrency/retry ceilings, dead-letter handling, and a
  priority queue; and
- no per-guest unit of work and no per-event AI invocation.

Missing, unavailable, stale, inconsistent, uncertain, unknown, unsupported,
malformed, unbounded, shared-booking, or self-authorizing input returns ordered
finite reasons. Meter uncertainty may produce a `requeue_candidate` only when
all retry and dead-letter controls are valid, the retry limit is not exhausted,
and `safeToRequeue` is true. All boundary, authority, configuration, workload,
and booking failures produce `block_candidate`.

## Operational limit

This contract reads no live meter and performs no metering, reservation,
throttling, pausing, requeue, scheduling, queue, workflow, notification,
execution, persistence, booking, or production operation. It cannot prove that
a provider limit, timestamp, age, workload-control claim, or isolation claim is
true. Provider adapters and P5-006 saturation verification must establish those
facts under separately approved packets before runtime activation.

Validate the finite contract with:

```text
node tests/resource-governance/validate-resource-budget-contract-v1.mjs
```
