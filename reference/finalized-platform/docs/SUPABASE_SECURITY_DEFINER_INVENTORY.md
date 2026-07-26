# Supabase SECURITY DEFINER Review

Last reviewed: 2026-07-10

Every reviewed function pins `search_path` to an empty value. The staging advisor
warnings below are therefore about execution grants, not search-path injection.

| Function | Source | Purpose | Authenticated execution | Risk / action |
| --- | --- | --- | --- | --- |
| `public.create_stripe_refund_request` | `20260708152000_stripe_refund_review_workflow.sql` | Creates an audited refund request after staff RBAC checks. | Required for staff UI. | Accepted with role and hotel checks. |
| `public.complete_stripe_refund_request` | `20260708165000_fix_partial_refund_payment_event.sql` | Records Stripe's completed/processing refund state. | Not required. | Revoke from `authenticated`; grant only `service_role` in `20260710092951_restrict_refund_reconciliation_rpc_grants.sql`. |
| `public.fail_stripe_refund_request` | `20260708152000_stripe_refund_review_workflow.sql` | Records failed Stripe refund state. | Not required. | Revoke from `authenticated`; grant only `service_role` in `20260710092951_restrict_refund_reconciliation_rpc_grants.sql`. |
| `public.requeue_dead_letter_notification` | `20260703134133_notification_delivery_production_readiness.sql` | Requeues a dead-letter notification after staff/RBAC validation. | Required for staff operations. | Accepted only after verifying role and hotel predicates remain covered by regression tests. |
| `public.clear_email_suppression` | `20260703134133_notification_delivery_production_readiness.sql` | Clears a suppression record after staff/RBAC validation. | Required for staff operations. | Accepted only after verifying role and hotel predicates remain covered by regression tests. |
| `private.approver_user_id_for_manager_pin` | `20260710121500_staff_manager_approval_pin_gate.sql` | Verifies a manager/admin PIN hash for a late cancellation. | No; revoked from all runtime roles. | Private helper, safe after staging migration verification. |

`stripe_webhook_events` and `stripe_webhook_event_outcomes` deliberately have
RLS enabled with no policies and no public grants. They are service-role-only
append-only ledgers. Retain that posture; do not add broad authenticated policies
only to silence the advisor.

## Dashboard Action

In Supabase Dashboard, enable Auth > Password Security > leaked password
protection for staging, then production before launch. Re-run the security
advisor and attach its result to the launch record.
