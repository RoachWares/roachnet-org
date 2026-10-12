-- Free-tier hardening, part 6 of 6 (applied 2026-10-12).
--
-- The sign-up ticket hook runs as supabase_auth_admin and calls extensions.hmac.
grant usage on schema extensions to supabase_auth_admin;
