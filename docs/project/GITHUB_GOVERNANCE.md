# GitHub Governance

## Local audit

The GitHub CLI is authenticated as `bruno-wut` (administrator). The intended target `bruno-wut/sut-ai-os` is confirmed, and the authorized bootstrap branch `chore/codex-workspace-bootstrap` is now pushed. The remote has no protection rulesets or environments; governance remains unconfigured until a later approved action. The finalized application repositories remain out of scope.

## Pull requests and issues

`.github/PULL_REQUEST_TEMPLATE.md` requires task/workflow identity, evidence, architecture references, routing, scope, acceptance criteria, checks, risks, prohibited-path confirmation, autonomy, production-write permission, rollback, verification, preview, and reviewer. A PR is expected to represent one valid task packet on one branch. `.github/ISSUE_TEMPLATE/task.yml` captures bounded work before implementation.

`CODEOWNERS` is deliberately comment-only until verified GitHub handles are supplied. Enabling code-owner review with invented handles would create a false control.

## CI controls

`Governance / validate` runs on pull requests and pushes to the known local primary candidates. It performs task-packet validation, task/branch and PR metadata checks, required verification-result checks, forbidden-path and secret scans, JSON schema parsing, policy presence checks, agent frontmatter checks, and the repository's existing `verify:fast` command. Missing PR metadata or verification evidence is advisory outside Actions and blocking in Actions. No deployment, database, payment, DNS, or secret operation is performed.

Run locally:

```text
npm run github:validate -- --task SUT-AIOS-GOV-008
npm run task:validate -- --all
npm run verify:fast
```

## Remote hardening commands (prepared, not executed)

Do not run these until repository identity and authority are confirmed and the proposed rules have been reviewed. Replace `OWNER/REPO`, `PRIMARY`, and the check context with verified values. Save each remote change in `docs/project/BOOTSTRAP_CHANGELOG.md` before execution.

```text
gh auth status
gh repo view OWNER/REPO --json nameWithOwner,defaultBranchRef,visibility
gh api repos/OWNER/REPO/branches/PRIMARY/protection
gh api --method PUT repos/OWNER/REPO/branches/PRIMARY/protection --input .github/branch-protection.request.json
gh api --method PUT repos/OWNER/REPO/environments/staging --input .github/staging-environment.request.json
gh api --method PUT repos/OWNER/REPO/environments/production --input .github/production-environment.request.json
gh api repos/OWNER/REPO/rulesets
```

The branch-protection request must preserve existing rules and require pull requests, one approving review, stale-review dismissal, the `Governance / validate` check, enforced administrators, and no force pushes. Repository rulesets should additionally prevent deletion and force-pushes on the primary branch. Staging may allow the CI bot; production must require explicit reviewers and remain separate. These are exact API entry points, but payloads and reviewer IDs must be generated only after `gh repo view` confirms the repository and existing rules.

## Change safety

Remote protection is not applied by this bootstrap. Production database/RLS, payment credentials, destructive booking changes, unrestricted SQL, secret exposure, and ordinary production deployment remain prohibited. A failed required check makes a change ineligible for production. Independent verification must record a machine-readable result under `evidence/verification/<task-id>/`.
