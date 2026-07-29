# Intelligence Provider Contracts V1

P2-002 defines a provider-neutral, non-authoritative data boundary for bounded
intelligence analysis. Its public runtime surface is exactly:

```js
validateIntelligenceRequest(input)
validateIntelligenceResult(input, request)
```

The committed request and result schemas are the structural authorities. The
deep module privately loads them and enforces semantic rules that Draft 2020-12
cannot express, including ordered identifiers and interventions,
classification ordering, request/result references, hypothesis ranks,
confidence bands, and provider-state reason mappings. Callers cannot replace
schemas, validators, policies, dependencies, or configuration.

Ajv 8.17.1 is a pinned runtime dependency because the deep module compiles the
two committed structural authorities when it loads. The package lock keeps Ajv
and its transitive graph in production installations that omit development
dependencies; authority-load failure still returns
`INTERNAL_AUTHORITY_UNAVAILABLE` rather than failing open.

## Boundary and responsibility

The request carries only bounded, prepared `public` or `internal` evidence. A
`deterministic_analytics` item is an integrity-labelled summary of a result
already produced through P2-001's canonical `calculateMetricComparison`
boundary and R02 structural-plus-semantic assurance. P2-002 neither imports the
calculator nor treats schema acceptance alone as proof of that provenance.

The result may explain likely causes, rank hypotheses, select a permitted
advisory intervention, and estimate confidence. It is always marked
`nonAuthoritative: true`. It cannot approve itself, grant capabilities, issue a
command, claim verification, or authorize execution. `IntelligenceProvider`,
provider adapters, prompts, transport, storage, model invocation, proposals,
policy, approval, execution, verification, and audit persistence remain outside
this module.

The future hexagonal boundary is conceptually
`IntelligenceProvider.analyze(request) -> result`. Application logic will depend
on that port; provider SDKs and CLI behavior will remain private adapters. This
task implements only the contracts, not that port or an adapter.

## Fail-closed behavior

Both functions are synchronous, deterministic, total, side-effect free, and
return deeply frozen plain-data clones. Malformed or hostile JavaScript values,
unsupported classification or purpose, missing committed authority, malformed
provider output, inconsistent references, and all non-available provider states
fail closed. An invalid request is rejected before provider output is inspected.
Only the trusted request-validation path constructs request-level `rejected`
decisions. Once a request is valid, `validateIntelligenceResult` rejects every
caller- or provider-supplied `rejected` variant as the singleton
`MALFORMED_PROVIDER_RESULT`; provider output cannot relabel itself with request
failure reasons.

The only admitted provider states are `available`, `busy`, `rate_limited`,
`capacity_exhausted`, `authentication_required`,
`temporarily_unavailable`, and `disabled`. Only `available` can accompany a
completed or insufficient-evidence analysis. Every other state maps to one
fixed reason code and cannot trigger action or bypass policy.

## Human control and verification

Tier 0 analysis may investigate and recommend only. P1-005 policy evaluation
and authenticated human approval remain mandatory for architectural,
security-sensitive, production, payment, inventory, pricing, database, RLS,
and destructive actions. Verify this boundary with:

```text
node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs
```

Rollback removes only the two P2-002 schemas, the contract module, validator,
this document, and P2-002 state/evidence. It does not alter P2-001/R02 or any
provider, runtime, production system, or historical evidence.
