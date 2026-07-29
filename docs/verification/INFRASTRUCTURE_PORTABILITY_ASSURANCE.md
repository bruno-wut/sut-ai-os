# Infrastructure portability assurance

This mandatory QA gate applies to future infrastructure packets derived from
ADR-0002. It authorizes no account, provider, deployment, data transfer, or
production write.

QA rejects an implementation that stores every guest page view, click, scroll,
or marketing event permanently; creates a queue message, workflow, or AI call
per interaction; imports Cloudflare, Supabase, GitHub, OpenAI, LINE, database,
or local-server SDKs in core/domain logic; exposes Staff/AI publicly without
authentication; shares booking credentials, quotas, deployments, or failure
boundaries with Staff/AI workloads; omits explicit retention/budget authorities
or bounded batching/dedupe/idempotency/backpressure/retry/DLQ behavior; or fails
open for malformed input, missing authority, unknown configuration, unavailable
dependencies, saturation, unsupported capability, or missing, unavailable,
stale, inconsistent, or uncertain metering. QA also rejects a cross-account call
without authenticated audience-bound short-lived credentials, timestamp/nonce
replay rejection, idempotency, bounded body/timeout, and per-authenticated-
caller/per-route rate limits.

Independent review must inspect imports/composition, run packet-authorized
negative cases, confirm 50/75/90 threshold behavior and every metering-unknown
state, and confirm that migration
claims use fixtures/reference adapters unless a separate live-migration packet
explicitly expands scope.
