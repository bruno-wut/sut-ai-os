# PR #2 Governance Failure Audit

## Failed run

- Pull request: `bruno-wut/sut-ai-os#2`
- Failed run: `30204292901`
- Failed check: `Governance / validate/validate`
- Preserved result: `evidence/verification/SUT-AIOS-P0-001/verification-20260726132632601.json` and the GitHub Actions run history.

## Exact failure

The GitHub workflow passed task-packet discovery, branch/task matching, committed verification evidence, forbidden-path inspection, secret scanning, schemas, policies, and agent definitions. It failed only `pr-metadata` because the pull-request body contained an auto-generated commit list and did not contain `SUT-AIOS-P0-001`.

## Root cause and correction

The task branch and base history were valid. GitHub's detached merge checkout and Node/npm setup were valid. The PR was created without the required task metadata body. The correction is a PR-body update containing the required task ID and governance attestations; no governance check was weakened and no branch exemption was added.
