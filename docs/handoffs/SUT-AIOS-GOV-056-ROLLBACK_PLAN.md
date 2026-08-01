# Rollback Plan: SUT-AIOS-GOV-056

## Overview
This document provides exact, step-by-step instructions to safely revert the workflow optimization and model routing changes implemented in `SUT-AIOS-GOV-056` back to the previous baseline state.

---

## 1. Trigger Conditions for Rollback
Rollback to the previous baseline workflow if any of the following occur:
1. `npm run github:validate` or `npm run verify:fast` fails due to schema or routing validation incompatibilities across existing tasks.
2. The Declarative Validator Registry (`policies/validator-registry-v1.json`) misses a critical test or fails to execute active validator scripts.
3. Post-merge reconciliation bot commits fail to execute cleanly on `main`.
4. Task Packet V2 schema parsing breaks backward compatibility with V1 tasks.

---

## 2. Fast Rollback via Git (If Branch/Commit Unmerged)
If changes are on a local branch or unmerged PR:

```bash
# 1. Ensure working directory is clean or stash active changes
git status

# 2. Revert back to main or previous commit before SUT-AIOS-GOV-056
git checkout main
git reset --hard HEAD

# 3. Clean untracked generated files
git clean -fd
```

---

## 3. Reverting Merged Revisions via Revert Commit
If `SUT-AIOS-GOV-056` has already been merged to `main`:

```bash
# 1. Identify the merge commit for SUT-AIOS-GOV-056
git log --oneline -n 5

# 2. Revert the commit cleanly
git revert -m 1 <MERGE_COMMIT_SHA> -m "Revert SUT-AIOS-GOV-056 workflow optimization"

# 3. Run fast verification to confirm baseline restored
npm run verify:fast
npm run github:validate

# 4. Push revert commit to main
git push origin main
```

---

## 4. Re-enabling Legacy 7-PR Workflow
1. Legacy Task Packet V1 schemas (`schemas/task-packet.schema.json`) remain present in the repository and continue to be valid.
2. To use the legacy 7-PR sequence for a new task, set `"schemaVersion": "1.0.0"` in `task.json` and follow the standard GOV-Plan ➔ GOV-Admit ➔ Product Delivery cycle.

---

## 5. Verification After Rollback
Run the following verification suite to guarantee system integrity after rollback:
```bash
npm run verify:fast
npm run github:validate
node scripts/task/validate --all
```
Both commands must exit with status `0` / `pass`.
