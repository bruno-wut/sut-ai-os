# Supabase Leaked Password Protection

## Current Status

Staging project `xvvuehwohxybfwpvndas` reported
`auth_leaked_password_protection` as **disabled** on 2026-07-11.

**Decision:** accepted and skipped for the current Supabase Free-tier posture,
where this control is unavailable. It is not a launch blocker for this
release. Re-evaluate it before any plan upgrade or security-baseline review.

## Required Dashboard Action

If the selected Supabase plan exposes this setting, enable it separately for
staging and production:

1. Open **Supabase Dashboard -> Authentication -> Providers -> Email**.
2. Enable **Leaked password protection**.
3. Save the provider configuration.
4. Capture the dashboard confirmation in the launch evidence folder.

## Verification

While on Free tier, retain the Security Advisor warning as documented accepted
risk. When the setting becomes available, rerun the advisor after enabling it;
the `auth_leaked_password_protection` warning must no longer be present. Then
attempt a password reset/sign-up using a known compromised test password in a
non-production account; Auth must reject it without exposing whether an
existing account uses that password.

Do not treat a database migration as evidence for this setting: it is a
Supabase Auth dashboard configuration, not PostgreSQL schema state.
