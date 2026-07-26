# Qwen allowed tasks

Qwen local is an untrusted, offline preprocessing assistant. The wrappers default to read-only, cap inputs at 256 KiB, mask common email/phone/numeric-PII patterns, enforce a timeout budget, emit structured JSON, and mark every output unverified.

Allowed operations:

- `local-ai:repo-map`
- `local-ai:summarize-module`
- `local-ai:classify-logs`
- `local-ai:redact-evidence`
- `local-ai:compare-schemas`
- `local-ai:summarize-diff`
- `local-ai:draft-fixtures`
- `local-ai:check-content`
- `local-ai:health`

Operations require an explicit repository-local input file for preprocessing. The wrapper never accepts a production credential, `.env`/secret-like path, immutable compatibility-baseline path, shell-generation instruction, SQL command, or production database target. It cannot write application code or content.

Qwen output is not evidence, approval, policy, a task packet, a production instruction, or final QA. Every result requires deterministic validation and independent Luna/Terra/Sol or human review. PII masking is a safety reduction, not proof that data is non-sensitive.
