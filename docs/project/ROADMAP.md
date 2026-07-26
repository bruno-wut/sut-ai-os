# Roadmap

## 0. Workspace and governance foundation — complete

The governed workspace, permanent memory, task/evidence workflow, immutable compatibility boundary, risk register, non-deploying validation practice, GitHub workflow, and technical baseline gate are established on `main`. Production writes and autonomous operation remain disabled.

## 0A. Existing platform stabilization — current

The baseline gate (`SUT-AIOS-P0-001`) and dependency/security remediation (`SUT-AIOS-P0-002`) are done. `SUT-AIOS-P0-003` remains ready because its sole dependency is complete; its executable compatibility-verification design is governed by `SUT-AIOS-GOV-013` before implementation begins.

## 1. Trusted control foundation

Define event, task, analysis, proposal, approval, and result schemas; create deterministic path/command/data policies; establish audit conventions, correlation IDs, task packets, and observe-only defaults.

`SUT-AIOS-P1-001` is ready to create the static normalized system-event schema and offline validator defined by `SUT-AIOS-GOV-015`. Event ingestion, queues, databases, and production access remain out of scope.

## 2. Intelligence and reporting

Add prepared metrics, read-only data interfaces, structured analysis outputs, initial insight/report workflows, and Staff OS integration designs. No autonomous production changes.

## 3. Durable orchestration

Introduce event ingestion, queues, workflow state, retries, approval waits, cancellation, and outcome tracking after the control foundation is verified.

## 4. Bounded Codex execution

Add scoped executor integration, isolated worktrees/runners, structured results, independent verification, and pull-request-only delivery. Start with low-risk, reversible playbooks.

## 5. Progressive autonomy

Promote only playbooks with verified safety, low rollback rates, reliable evidence, and measurable benefit. Higher-risk commercial, payment, inventory, and production actions remain human-gated or prohibited.

The phase order is intentional; do not skip governance to build autonomous features first.
