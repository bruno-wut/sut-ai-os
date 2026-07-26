-- Restore server-side application access for Supabase service-role clients.
--
-- Several hardening migrations deliberately revoked public/anon/authenticated
-- access, but the Next.js server routes use the service-role key for trusted
-- booking, webhook, lookup, and staff bootstrap operations. Supabase service
-- role bypasses RLS, but it still needs object privileges after explicit
-- REVOKE statements.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;
