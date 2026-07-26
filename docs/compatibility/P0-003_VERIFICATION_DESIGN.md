# P0-003 Compatibility Contract Verification Design

## Purpose

P0-003 will capture a small, machine-readable compatibility contract for the immutable `reference/finalized-platform/` snapshot. The contract is an interface inventory, not a build, deployment, installation, or modification of that snapshot.

## Contract boundary

The first contract version covers only stable, repository-visible interfaces:

- root and Astro package names plus declared script names;
- selected public Next route files: guest booking, checkout, confirmation, booking lookup, and health;
- selected API route files: booking lookup, checkout hold, pay-at-hotel, health, notifications process, Resend webhook, Stripe checkout session, and Stripe webhook;
- selected storefront entry points: `website/astro-site/package.json` and `website/astro-site/src/pages/**`.

The initial source inventory is intentionally explicit and finite. P0-003 must capture only these snapshot-relative paths:

- `package.json` and `website/astro-site/package.json`;
- `src/app/(guest)/book/page.tsx`, `src/app/(guest)/checkout/page.tsx`, `src/app/(guest)/confirmation/page.tsx`, and `src/app/(guest)/lookup/page.tsx`;
- `src/app/api/booking-lookup/route.ts`, `src/app/api/checkout/hold/route.ts`, `src/app/api/checkout/pay-at-hotel/route.ts`, `src/app/api/health/route.ts`, `src/app/api/notifications/process/route.ts`, `src/app/api/resend/webhook/route.ts`, `src/app/api/stripe/checkout-session/route.ts`, and `src/app/api/stripe/webhook/route.ts`;
- `website/astro-site/src/pages/index.astro`.

The contract must reject a missing explicitly listed path. It must not treat discovery of additional snapshot files as a reason to expand the contract without a new approved packet amendment.

The contract must contain relative paths and literal script names only. It must not contain environment values, credentials, guest data, payment payloads, booking records, or deployment configuration.

## P0-003 implementation shape

P0-003 creates exactly two functional artifacts:

1. `packages/compatibility-contracts/finalized-platform-contract.json` — the reviewed expected interface inventory.
2. `tests/compatibility/validate-finalized-platform-contracts.mjs` — a Node-only validator that reads the contract and the immutable snapshot, then fails deterministically for malformed JSON, missing required keys, duplicate entries, absent listed files, missing package scripts, or unexpected values outside the declared inventory.

The validator may read the immutable snapshot but must never write beneath it, execute its package scripts, install dependencies, contact a network service, or load environment files. The compatibility contract remains owned by this governance repository.

## Exact execution command

The P0-003 packet must use this direct, deterministic command:

```text
node tests/compatibility/validate-finalized-platform-contracts.mjs
```

This replaces the nonexistent `npm run test:contracts` script. `npm run verify:fast` and `git diff --check` remain required checks.

## Failure behavior

The validator exits nonzero and prints a concise machine-readable failure when an expected interface is absent, a contract value is invalid, or the contract file cannot be parsed. It must not infer replacements, mutate the contract, or silently skip a missing interface.

## Verification and rollback

P0-003 must run the exact validator, fast governance verification, changed-path inspection, secret-boundary inspection, and independent verification. Rollback removes only the new contract and validator from the P0-003 branch; the snapshot stays untouched.
