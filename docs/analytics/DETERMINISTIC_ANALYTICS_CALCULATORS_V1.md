# Deterministic Analytics Calculators V1

P2-001 provides one stable public function:

```text
calculateMetricComparison(request)
```

Callers provide prepared, finite observations through this input port and
receive a frozen deterministic result through the output port. Validation,
reason ordering, rounding, confidence selection, and result construction remain
private. The core has no database, API, queue, filesystem, environment, clock,
model-provider, framework, or other infrastructure dependency. Future data
sources and report renderers are separate adapters and are not part of V1.

The committed request and result authorities are
`schemas/deterministic-analytics-calculator-request-v1.schema.json` and
`schemas/deterministic-analytics-calculator-result-v1.schema.json`. Ordinary
callers cannot replace these authorities or inject schemas, configuration, or
dependencies. Malformed or unsupported input never throws and returns the fixed
closed `invalid` result.

Correlation identifiers, anomaly duration, and seasonality are caller-declared
display context. `not-evaluated` means no seasonality conclusion was supplied.
The calculator does not infer correlation, causation, seasonality, diagnosis,
recommendation, risk, approval, or authorization from those fields.

P2-001 does not ingest external analytics, process guest data, query or persist
records, invoke AI, render a report, or authorize an intervention. It remains a
Tier 0 measurement boundary. Any production-impacting use remains subject to
the existing deterministic policy and authenticated human-approval controls.

Validate the complete finite contract locally with:

```text
node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs
```

Rollback removes only the two V1 schemas, the analytics module, validator,
documentation, and P2-001 evidence/state changes. It does not alter any Phase 1
authority or external system.
