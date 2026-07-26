# Agent Definition Guidance

## Subsystem purpose

`agents/` stores versioned role definitions for the AI OS. The child directories group command, intelligence, execution, assurance, learning, and optional roles; they do not contain runtime agents yet.

## Important entry points

- `agents/command/` — coordination and approval-facing roles.
- `agents/intelligence/` — analysis and planning roles.
- `agents/execution/` — bounded implementation roles.
- `agents/assurance/` — review, verification, and audit roles.
- `agents/learning/` — feedback and improvement roles.
- `agents/optional/` — explicitly opt-in roles.

## Commands

- Inspect definitions with `rg --files agents`.
- Check the change with `git diff --check`.
- Run any schema or fixture validation named by the approved task packet; no agent-specific test runner exists yet.

## Local conventions

- Keep one role definition per durable file.
- State purpose, inputs, outputs, authority limits, escalation triggers, and evidence expectations.
- Reference shared policies and schemas by link; do not copy their full text.
- Keep role names stable and avoid embedding provider credentials, prompts containing secrets, or production identifiers.

## Allowed modifications

Modify only the role files explicitly allowlisted by an approved governance task packet. New roles require assurance review and a documented owner, scope, and model route.

## Sensitive files

Command, execution, and assurance role definitions can affect authorization and verification. Treat all role definitions as governance artifacts even when they are currently placeholders.

## Prohibited actions

- Do not grant a role production, database, payment, DNS, or deployment authority.
- Do not encode unrestricted SQL, secret material, or bypasses for verification or review.
- Do not edit canonical architecture sources from this directory.

## Required tests

Use packet-specified schema/format checks, link checks, and an independent review by a role not authoring the change. Confirm no authority boundary is widened accidentally.

## Expected evidence

Record the changed role paths, deterministic check output, independent review, authority-diff assessment, and unresolved concerns in the task evidence destination.

## Escalation triggers

Escalate changes involving architecture, security, payment, concurrency, RLS, production access, model routing, or a new authority boundary to the appropriate specialist before completion.
