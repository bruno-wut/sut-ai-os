# Playbook Guidance

## Subsystem purpose

`playbooks/` stores versioned operational procedures for repeatable, human-auditable work. It is currently a scaffold with no active playbooks.

## Important entry points

The directory root is the future entry point. Each playbook should link to its governing policy, task packet template, runbook or evidence format, and owner.

## Commands

- Inspect playbooks with `rg --files playbooks`.
- Check the change with `git diff --check`.
- Run the deterministic procedure checks named by the approved task packet; no playbook runner exists yet.

## Local conventions

- Make preconditions, inputs, approvals, bounded commands, rollback, verification, and evidence explicit.
- Separate observe-only steps from mutating steps.
- Use stable identifiers and link to policies and schemas instead of duplicating them.
- Write procedures so a human reviewer can reproduce the recorded outcome.

## Allowed modifications

Create or change playbooks only under an approved governance task packet with an identified owner and reviewer. A playbook may describe an action without granting authority to perform it.

## Sensitive files

Procedures concerning production systems, bookings, payments, databases, RLS, DNS, secrets, or incident response are high-sensitivity governance artifacts.

## Prohibited actions

- Do not include secrets, live credentials, unrestricted SQL, or unapproved production commands.
- Do not turn a playbook into an implicit deployment or database-change authorization.
- Do not edit canonical architecture sources from this directory.

## Required tests

Validate links and formatting, check command/path allowlists, and perform an independent procedural review. Where possible, run a dry-run or fixture-based rehearsal without external side effects.

## Expected evidence

Record the playbook diff, owner approval, dry-run or deterministic checks, independent review, rollback assessment, and any unresolved risks.

## Escalation triggers

Escalate when a procedure changes authority, touches production or external services, affects guest data, payments, inventory, pricing, booking state, RLS, or lacks a safe rollback.
