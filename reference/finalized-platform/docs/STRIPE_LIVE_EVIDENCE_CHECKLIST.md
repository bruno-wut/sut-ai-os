# Stripe Live Evidence Checklist

This is an operator checklist, not an activation instruction. Do not inject live
keys or enable live checkout while any other production gate is blocked.

- [ ] Stripe Dashboard shows the hotel account is fully live, not Sandbox/Test only.
- [ ] Thailand business registration verification is approved.
- [ ] Every required director or representative identity check is approved.
- [ ] Payout bank account is verified and payouts are enabled.
- [ ] Card payments capability is active with no restricted/capability warnings.
- [ ] Live webhook endpoint is registered for the final production booking host.
- [ ] Live webhook signing secret is stored only in production Cloudflare secrets.
- [ ] Staging secret begins with `sk_test_`; no `pk_live_`, `sk_live_`, or live webhook secret is present in staging.
- [ ] A controlled live smoke transaction, reconciliation, and refund procedure is approved by hotel finance.

Capture the Dashboard capability summary and webhook endpoint status in the launch
decision log. Do not include keys, bank details, identity documents, or webhook
secrets in that record.
