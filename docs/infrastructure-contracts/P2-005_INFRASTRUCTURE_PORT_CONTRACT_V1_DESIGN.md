# P2-005 Infrastructure Boundary and Port Contract V1 Design

## Decision, authority, and scope

P2-005 is a static Tier-0 contract boundary. It defines a finite vocabulary for
guest/public, staff/control, and AI/workload separation; a fail-closed descriptor
for narrowly bounded cross-zone calls; and provider-neutral application ports.
It does not authenticate a real caller, reserve capacity, persist replay or
idempotency state, dispatch a call, compose an adapter, select a provider, or
provision infrastructure.

The future product has one closed JSON Schema Draft 2020-12 structural
authority:

- `schemas/infrastructure-port-contract-v1.schema.json`.

The one committed canonical instance is:

- `policies/infrastructure-trust-zone-policy-v1.json`.

The schema contains the closed authority shape and the `$defs` for an untrusted
boundary-request descriptor and its closed validation decision/rejection. The
policy instance fixes all V1 zones, routes, protocol bounds, ports, operations,
authority exclusions, and isolation rules. Every schema object sets
`additionalProperties: false`.
One runtime-safe deep module,
`packages/infrastructure-contracts/src/infrastructure-port-contract-v1.mjs`,
loads and compiles both committed authorities internally and exposes exactly:

```text
validateInfrastructureBoundaryRequest(request)
```

The argument is untrusted plain data, never authority. The function accepts no
schema, policy, port registry, adapter, credential verifier, clock, nonce store,
idempotency store, rate limiter, quota state, provider configuration, or
dependency injection. Extra JavaScript arguments are ignored. A successful
validation means only that a normalized descriptor satisfies the static V1
contract; it is not authentication, authorization, approval, capacity
reservation, dispatch permission, or evidence that recipient-side checks
actually occurred.

## Deep-module and hexagonal boundary

Core/application logic depends on the following stable ports and on no adapter:

| Port | Exact V1 operations |
| --- | --- |
| `PersistencePort` | `read`, `write`, `append`, `delete_expired` |
| `EventIngestionPort` | `ingest_batch` |
| `AnalyticsSourcePort` | `read_aggregate` |
| `SchedulingQueuePort` | `enqueue`, `lease`, `acknowledge`, `requeue`, `dead_letter` |
| `WorkflowExecutionPort` | `start`, `resume`, `cancel`, `read_state` |
| `ObjectStoragePort` | `put`, `get`, `delete_expired` |
| `NotificationPort` | `send` |
| `IntelligenceProvider` | `analyze` |
| `DeploymentProvider` | `prepare`, `read_status`, `rollback` |
| `AuthenticationPort` | `verify_identity` |
| `ProposalGenerator` | `generate` |
| `ExecutorAdapter` | `execute` |
| `VerificationProvider` | `verify` |

The canonical policy lists those thirteen ports exactly in that order. Every
declaration requires exactly `port`, `operations`, `providerNeutral`,
`coreOwnsInterface`, `adapterOwnsProviderBehavior`,
`authorizationAuthority`, `workflowAuthority`, and `auditAuthority`. It fixes
`providerNeutral: true`, `coreOwnsInterface: true`,
`adapterOwnsProviderBehavior: true`, `authorizationAuthority: false`,
`workflowAuthority: false`, and `auditAuthority: false`. These operation names
are contract vocabulary, not implemented methods or permission to perform the
operation. In particular, `DeploymentProvider.prepare`,
`ExecutorAdapter.execute`, and `PersistencePort.write` remain subject to later
policy, authenticated approval, task, capability, and production gates.

Core has no imports from Cloudflare, Supabase, GitHub, OpenAI, LINE, local
server runtimes, database drivers, queue vendors, provider SDKs, or adapter
configuration. Adapters own provider SDKs, transport, credentials, validation
of cryptographic material, clocks, replay/idempotency storage, metering, and
provider error mapping. Composition selects adapters outside core. Replacing a
provider changes an adapter and configuration, not domain/application logic,
and cannot transfer policy, authorization, workflow, approval, or audit
authority to the provider.

## Canonical policy artifact

The root policy object is closed and requires exactly `schemaVersion`,
`policyId`, `zones`, `crossZoneProtocol`, `routes`, `ports`,
`coreDependencyRules`, `bookingIsolation`, and `authority`.

`schemaVersion` is `1.0.0`; `policyId` is
`infrastructure-trust-zone-policy-v1`. The three zones occur exactly in this
order. Each zone object requires exactly `zone`, `exposure`,
`credentialBoundaryId`, `quotaBoundaryId`, `deploymentBoundaryId`, and
`failureBoundaryId`:

| Zone | Exposure | Boundary identifiers |
| --- | --- | --- |
| `guest_public` | `public_guest_only` | credential `guest-credential`, quota `guest-quota`, deployment `guest-deployment`, failure `guest-failure` |
| `staff_control` | `authenticated_staff_only` | credential `staff-credential`, quota `staff-quota`, deployment `staff-deployment`, failure `staff-failure` |
| `ai_workload` | `non_public_workload_only` | credential `ai-credential`, quota `ai-quota`, deployment `ai-deployment`, failure `ai-failure` |

All twelve boundary identifiers are distinct. Co-location on one Mac Mini does
not permit them to collapse. `staff_control` and `ai_workload` are never public
guest endpoints.

`crossZoneProtocol` requires exactly `protocol`, `method`, `credentialMode`,
`credentialLifetimeMaxSeconds`, `audienceBound`, `recipientChecks`,
`timestampSkewMaxSeconds`, `replayWindowSeconds`, `nonceRequired`,
`idempotencyRequired`, `duplicateDisposition`, `requestBodyMaxBytes`,
`responseBodyMaxBytes`, `timeoutMinMs`, `timeoutMaxMs`, and `rateLimitScopes`.
It is fixed to authenticated HTTPS POST and requires:

- audience-bound credentials with maximum lifetime 300 seconds;
- recipient-side credential, expiry, audience, timestamp, nonce, replay,
  idempotency, caller-limit, and route-limit checks before dispatch;
- maximum clock skew 60 seconds and replay window 300 seconds;
- a one-time nonce and idempotency key on every request;
- duplicate-same-request handling as
  `return_prior_result_without_dispatch`, never redispatch;
- request body maximum 65,536 bytes, response body maximum 262,144 bytes, and
  timeout range 100-10,000 milliseconds;
- both `authenticated_caller` and `route` rate-limit scopes.

`credentialMode` is `short_lived`; `recipientChecks` is exactly
`credential`, `expiry`, `audience`, `timestamp`, `nonce`, `replay`,
`idempotency`, `caller_limit`, and `route_limit` in that order.

The five permitted cross-zone route classes are exact and ordered. Every route
object requires exactly `routeClass`, `sourceZone`, `targetZone`, `port`, and
`operation`:

| Route class | Source -> target | Port and operation |
| --- | --- | --- |
| `aggregate_or_lifecycle_ingest` | `guest_public` -> `staff_control` | `EventIngestionPort.ingest_batch` |
| `prepared_analytics_read` | `staff_control` -> `guest_public` | `AnalyticsSourcePort.read_aggregate` |
| `bounded_work_request` | `staff_control` -> `ai_workload` | `SchedulingQueuePort.enqueue` |
| `bounded_work_result` | `ai_workload` -> `staff_control` | `WorkflowExecutionPort.read_state` |
| `staff_notification` | `ai_workload` -> `staff_control` | `NotificationPort.send` |

V1 denies same-zone use through this cross-zone descriptor, direct guest/AI
traffic, reversed routes, and every route/port/operation mismatch. The first
route admits only approved aggregate or essential booking-lifecycle envelopes;
P2-006 will define their data-minimisation authority. It never grants access to
booking storage or makes guest availability depend on Staff/AI services.

`coreDependencyRules` contains the fixed forbidden provider families
`cloudflare`, `supabase`, `github`, `openai`, `line`, and `local_server`, plus
`providerSdkImportsAllowedInCore: false`,
`providerConfigurationAllowedInCore: false`,
`compositionLocation: "outside_core"`, and
`providerReplacementMode: "adapter_and_configuration_only"`.

`bookingIsolation` fixes all of
`guestBookingDependsOnStaffAvailability`,
`guestBookingDependsOnAiAvailability`, `sharedCredentials`, `sharedQuotas`,
`sharedDeployments`, and `sharedFailureBoundaries` to false. `authority` fixes
`nonAuthoritative: true`, `providerMayAuthorize: false`,
`requestMayAuthorize: false`, `validationMayDispatch: false`,
`policyBypassAllowed: false`, and `productionWriteGranted: false`.

## Closed boundary-request descriptor

The request root requires exactly `schemaVersion`, `requestId`, `routeClass`,
`sourceZone`, `targetZone`, `port`, `operation`, `transport`,
`securityEvidence`, `deliveryEvidence`, `limitEvidence`,
`isolationEvidence`, and `authorityClaims`.

Identifiers use `^[a-z][a-z0-9-]{0,63}$`; `requestId` uses
`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`. Integer sizes and durations use the
bounds below. No token, secret, raw credential, URL, provider SDK object,
command, executable payload, storage locator, database key, or guest record is
admitted.

| Object | Exact required fields |
| --- | --- |
| root | version/ID, one finite route class, source/target zone, port, operation, and the six closed objects below |
| `transport` | `protocol: "https"`, `method: "POST"`, `requestBodyBytes` 0-65,536, `responseBodyLimitBytes` 1-262,144, `timeoutMs` 100-10,000 |
| `securityEvidence` | `factSource: "recipient_adapter"`; `credentialStatus`; `credentialAudience`; `credentialLifetimeSeconds` 1-86,400; `credentialAgeSeconds` 0-86,400; `timestampStatus`; `nonceStatus` |
| `deliveryEvidence` | `idempotencyKey`, an identifier or null; `idempotencyStatus` |
| `limitEvidence` | `authenticatedCallerId`; `callerLimitStatus`; `routeLimitStatus` |
| `isolationEvidence` | five booleans: credentials/quotas/deployments/failure boundaries shared with guest, and booking availability dependent on internal services |
| `authorityClaims` | `providerAuthorizes`, `callerAuthorizes`, `requestAuthorizes`, `policyBypassed`, `productionWriteGranted`, all false |

`credentialStatus` is one of `valid`, `missing`, `invalid`, `expired`, or
`audience_mismatch`. `credentialAudience` is one of the three zones or null.
Only `valid` with audience exactly equal to `targetZone`, lifetime at most 300
seconds, and age no greater than lifetime passes.

`timestampStatus` is `within_window`, `missing`, `outside_window`, or
`invalid`; only `within_window` passes. `nonceStatus` is `fresh`, `missing`,
`reused`, or `invalid`; only `fresh` passes.

`idempotencyStatus` is `new`, `missing`, `duplicate_same_request`, or
`conflict`. Only `new` validates for new dispatch. `duplicate_same_request`
returns a fail-closed rejection that a future trusted adapter may translate to
the already committed result without redispatch. `conflict` is always rejected.
The idempotency key uses the request-ID expression.

Caller and route limit states are independently `within_limit`, `exceeded`,
or `unknown`. Only two `within_limit` states pass. Missing, stale,
inconsistent, unavailable, or uncertain metering is represented as `unknown`
and fails closed. P2-007 will separately define numeric budgets and thresholds.

All isolation-evidence booleans must be false. These are normalized facts for a
future recipient adapter; the untrusted network caller must never be permitted
to assert or construct them as trusted evidence. A P2-005 validation success
cannot substitute for recipient authentication, replay storage, idempotency
storage, rate limiting, quota reservation, policy evaluation, or approval.

## Executable validator result and safe-data boundary

The public function is synchronous, deterministic, side-effect free, and total.
It returns a deeply frozen closed decision with exactly `ok`, `value`, and
`rejection`:

- valid: `{ok:true, value:<deeply frozen plain-data clone>, rejection:null}`;
- invalid: `{ok:false, value:null, rejection:{schemaVersion:"1.0.0", failClosed:true, reasonCodes:[...]}}`.

No input is returned by reference or mutated. Guarded plain-data cloning rejects
accessors, throwing proxies, symbols, functions, `bigint`, cycles, non-finite
numbers, non-plain prototypes, and values outside the closed schema. Schema or
canonical-policy loading/compilation failure is captured once; module import and
calls expose no Ajv or platform exception.

The function validates the internally committed policy before request use. It
does not accept a candidate policy as authority. The exact semantic interface
is a static conformance check only; downstream dispatch remains false until a
later trusted adapter has independently established live facts and separate
policy/approval gates have passed.

## Deterministic rejection precedence

Reason codes are unique and appear only in this order. A malformed parent
suppresses dependent checks.

1. `INTERNAL_AUTHORITY_UNAVAILABLE` is exclusive for unavailable, malformed,
   or semantically altered committed schema/policy authority.
2. `CALLER_AUTHORITY_INJECTION` is exclusive when the request root contains a
   `schema`, `policy`, `contract`, `adapter`, `configuration`, `validator`, or
   `dependencies` property. The module ignores extra JavaScript arguments and
   validates only committed authority; tests prove injected dependencies cannot
   turn a denial into success.
3. `MALFORMED_REQUEST` covers unsafe/non-object data, missing/unknown fields,
   wrong containers/types, invalid identifiers, and malformed nested objects.
4. `UNSUPPORTED_SCHEMA_VERSION` covers a present string version other than
   `1.0.0`.
5. `UNKNOWN_ZONE` covers a well-formed source or target outside the three-zone
   enum.
6. `ZONE_CONFUSION` covers same-zone use, direct guest/AI use, an unlisted
   direction, or a route whose zones do not match the canonical pair.
7. `UNSUPPORTED_ROUTE` covers an unknown route class.
8. `UNSUPPORTED_PORT` covers a port or operation outside the thirteen exact
   declarations.
9. `ROUTE_PORT_MISMATCH` covers a supported port/operation that does not match
   the selected route.
10. `INSECURE_TRANSPORT` covers non-HTTPS, non-POST, or invalid protocol/method.
11. `UNAUTHENTICATED_CALLER` covers missing or invalid credential state.
12. `INVALID_AUDIENCE` covers audience mismatch, null audience for a valid
    credential, or audience unequal to target.
13. `CREDENTIAL_EXPIRED` covers explicit expiry, lifetime above 300 seconds,
    or age beyond lifetime.
14. `INVALID_TIMESTAMP` covers any state other than `within_window`.
15. `REPLAY_DETECTED` covers a missing, invalid, or reused nonce.
16. `MISSING_IDEMPOTENCY_KEY` covers missing or malformed key/status.
17. `IDEMPOTENCY_CONFLICT` covers a key reused for different request facts.
18. `DUPLICATE_ACCEPTED_REQUEST` covers `duplicate_same_request` and forbids
    redispatch while preserving future retrieval of the prior result.
19. `REQUEST_BODY_LIMIT_EXCEEDED`, `RESPONSE_BODY_LIMIT_EXCEEDED`, and
    `TIMEOUT_LIMIT_EXCEEDED` cover their respective canonical bounds, in that
    order.
20. `CALLER_RATE_LIMITED` and `ROUTE_RATE_LIMITED` cover the corresponding
    `exceeded` state.
21. `UNKNOWN_LIMIT_STATE` covers either `unknown` limit state and is exclusive
    after the preceding limit checks.
22. `SHARED_CREDENTIAL_BOUNDARY`, `SHARED_QUOTA_BOUNDARY`,
    `SHARED_DEPLOYMENT_BOUNDARY`, and `SHARED_FAILURE_BOUNDARY` cover each true
    isolation flag, in that order.
23. `BOOKING_CAPACITY_DEPENDENCY` covers a request declaring that booking
    availability depends on Staff/AI availability or capacity.
24. `PROVIDER_AUTHORITY_CLAIM` covers `providerAuthorizes: true`.
25. `SELF_AUTHORIZATION_CLAIM` covers any other non-false authority claim.

Structural codes 3-10 may combine in precedence order when their parents are
independently well formed. Security, delivery, limit, isolation, and authority
failures are singleton after that pass so no lower-precedence fact can obscure
the first dispatch-blocking reason. Equivalent plain data always returns the
same decision regardless of key order, locale, time, provider, or environment.

## JSON Schema and semantic assurance split

Draft 2020-12 proves closed object shapes, primitive types, enums, patterns,
and numeric/collection bounds. It does not establish cryptographic credential
validity, current time, nonce freshness, replay history, idempotency history,
rate-limit truth, quota availability, process/deployment isolation, code-import
direction, or booking independence. It also does not conveniently prove the
exact ordered port registry, uniqueness by object identity, route-to-zone and
route-to-port mappings, boundary-ID separation, credential audience equality,
age/lifetime ordering, reason precedence, or hostile JavaScript safety.

The committed deep module enforces the finite cross-field semantics and validates
the canonical policy internally. The exact validator compiles the schema with a
Draft 2020-12 implementation, exercises the module, inspects its imports, and
mutates the committed policy only in the test harness to prove mutations cannot
be supplied as runtime authority. Actual security facts remain responsibilities
of later trusted recipient adapters and stateful services under separate tasks.

## Required product artifacts and verification

P2-005 must create exactly these product authorities and documentation:

- `schemas/infrastructure-port-contract-v1.schema.json`;
- `policies/infrastructure-trust-zone-policy-v1.json`;
- `packages/infrastructure-contracts/src/infrastructure-port-contract-v1.mjs`;
- `tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs`;
- `docs/infrastructure-contracts/INFRASTRUCTURE_PORT_CONTRACT_V1.md`.

The exact future validator command is:

```text
node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs
```

It must compile the committed schema under Draft 2020-12; validate the canonical
policy; prove its exact zone, route, protocol, port, dependency, booking, and
authority values; test every finite enum and bound; validate canonical requests;
and reject focused real exploit mutations. Required negative cases include
malformed/hostile input, unauthenticated/mis-audienced/expired credentials,
invalid timestamps, nonce replay, missing/conflicting/duplicate idempotency,
body/response/timeout overflow, caller/route limit bypass and unknown metering,
same-zone and guest/AI confusion, route/port mismatch, shared boundaries,
booking-capacity dependency, provider/self authority, unsupported ports, and
caller-supplied weakened schema/policy/dependencies. It proves deterministic
reason precedence, frozen cloned results, input non-mutation, repeated-call
stability, total never-throw behavior, and absence of infrastructure/provider
imports in core.

GOV-048 must first admit only that byte-for-byte command as `node` with one
fixed repository-relative path argument through the existing `shell: false`
runner. Near-miss tests reject whitespace, extra arguments, shell operators,
redirects, substitutions, alternate/sibling paths, dot paths, traversal,
absolute paths, and Windows separators. P2-005 remains backlog until GOV-047
and GOV-048 are done. Independent Sol QA, task-specific machine evidence, and
final-head CI are required before delivery.

## Non-goals and rollback

P2-005 creates no account, domain, DNS, HTTPS endpoint, service, credential,
secret, SDK, adapter, database, queue, workflow, object store, notification,
model/provider call, authentication implementation, clock, replay store,
idempotency store, rate limiter, quota meter, deployment, migration, production
write, SQL, RLS, payment, inventory, pricing, booking mutation, guest-data
retention, or autonomous behavior. P2-006 and P2-007 separately define
minimisation/retention and numeric budget authorities.

Rollback removes only the five P2-005 product artifacts, P2-005 state/evidence,
and its risk entry. It preserves ADR-0002, GOV-043/GOV-047/GOV-048 history,
P1/P2 terminal authorities and evidence, canonical architecture sources,
immutable snapshots, and every external system.
