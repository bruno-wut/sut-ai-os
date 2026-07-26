# Initial Model Routing Evaluation

Run evaluations only with approved task packets, sanitized fixtures, deterministic checks, and an independent verifier. The suite is an evidence-gathering program, not automatic routing policy.

| Task class | Candidate route | Primary measure | Escalate when |
| --- | --- | --- | --- |
| Repository discovery | Luna | accurate file map; low tokens | scope/architecture ambiguity remains |
| Documentation | Luna | factual links; reviewer acceptance | policy or architectural interpretation is needed |
| Ordinary implementation | Terra | first-pass verification; tokens/task | failures persist after ordinary debugging |
| Difficult debugging | Sol | root-cause correctness; rollback avoidance | N/A; specialist route is intentional |
| SEO analysis | Luna then Terra | evidence coverage; recommendation quality | commercial or technical intervention is consequential |
| Content-schema repair | Terra | schema/build pass; revision rate | content or contract ambiguity persists |
| Payment review | Sol | boundary findings; false-negative avoidance | N/A; never downgrade |
| RLS review | Sol | policy correctness; specialist review | N/A; never downgrade |
| Independent QA | Terra or Sol by risk | defect detection; verification independence | high-risk or ambiguous failure requires Sol |

For each class, create at least three comparable sanitized runs before treating the metrics as directional. Compare equal task scope, verification requirements, and environment. Record whether the model required rework, escalation, or human intervention. Qwen may participate only in its permitted offline preprocessing classes; acceptance requires hosted-model or human verification.

Recommended routing changes require a task packet, independent review, and an explicit update to the routing policy. The recommender output is not authorization.
