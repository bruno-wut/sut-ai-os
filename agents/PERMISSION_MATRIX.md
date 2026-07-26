# Agent Permission Matrix

This matrix is a design contract for future deterministic enforcement. A prompt or model configuration alone is not a security boundary. `None` means the agent must rely on a scoped service and cannot receive the underlying credential.

| Agent | Tools/data scope | Repository write | Commands | Highest role | Production authority |
| --- | --- | --- | --- | --- | --- |
| Chief Orchestrator | Workflow, registry, evidence, policy submission | None | None | Tier 2 proposal routing | None |
| Data and Anomaly Analyst | Prepared aggregate metrics and masked views | None | None | Tier 0 analysis | None |
| Operational Incident Investigator | Masked logs, incident/deployment/provider summaries | None | Read-only if workflow-listed | Tier 2 diagnosis only | None |
| SEO Strategist | GSC/analytics, public content/research, approved facts | None | None | Tier 1 recommendation | None |
| Content and Brand | Approved facts, brand/terminology, public content | None | None | Tier 2 draft only | None |
| Engineering Planner | Read-only repository, policy/schema/test inventory | None | Read-only if workflow-listed | Tier 3 analysis only | None |
| Codex Engineering Executor | Task evidence and allowlisted repository paths | Exact task allowlist | Exact packet allowlist | Tier 2 preparation only | None |
| Codex SEO and Content Executor | Reviewed copy and allowlisted storefront paths | Exact task allowlist | Exact packet allowlist | Tier 2 preparation only | None |
| QA and Verification | Read-only diff/repository and isolated test tools | Verification evidence only | Exact packet checks | Tier 2 verification | None |
| Release and Deployment | Protected release/status/smoke/rollback request services | None | None while staged | Tier 2 gated delivery request | None; deterministic release service executes after approval |
| Outcome and Learning | Aggregate outcome metrics and audit records | None | None | Tier 0 measurement | None |
| Executive Briefing | Verified summaries and secure delivery adapter | None | None | Tier 2 notification only | None; messages cannot mutate state |
| Revenue Proposal | Aggregate revenue data and deterministic simulator | None | None | Tier 2 proposal only | None |
| B2B Growth | Aggregate demand, public research, approved facts | None | None | Tier 2 proposal only | None |
| AEO Research | Public sampled answer/web research | None | None | Tier 0 research | None |

## Universal enforcement

- Credentials are brokered by deterministic services and scoped to one run; agents never receive broad production credentials.
- Raw guest PII, payment credentials, unrestricted SQL, production migrations, RLS changes, destructive booking actions, and policy self-modification are unavailable to all agents.
- Repository reads/writes, commands, external calls, approvals, and deployment operations are denied by default and allowlisted per task/workflow.
- Audit and policy services, approval records, workflow state, deployment gates, metric calculations, kill switches, and PDPA schedulers are deterministic components—not agent tools with discretionary behavior.
