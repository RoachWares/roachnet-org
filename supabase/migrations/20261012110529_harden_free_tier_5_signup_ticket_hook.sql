-- Free-tier hardening, part 5 of 6 (applied 2026-10-12).
--
-- A Before User Created auth hook (available on Free) that only lets an email
-- sign-up through when it carries a short-lived ticket minted by the
-- register-account function on accounts.roachnet.org. That function runs the
-- Turnstile check, the rate limits and the breached-password check first, so
-- calling /auth/v1/signup directly with the public key no longer skips them.
--
-- Ticket: v1.<unix expiry>.<hex HMAC-SHA256(secret, 'v1|' || email || '|' || expiry)>
-- The secret lives in private.signup_ticket_secret (insert it server-side, never
-- in a migration) and in the site's ROACHNET_SIGNUP_TICKET_SECRET env var.
--
-- The hook does nothing until it is switched on in the dashboard:
-- Authentication > Hooks > Before User Created > Postgres function
-- public.hook_require_signup_ticket.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.signup_ticket_secret (
  id boolean primary key default true check (id),
  secret text not null check (char_length(secret) >= 32),
  updated_at timestamptz not null default timezone('utc', now())
);
alter table private.signup_ticket_secret enable row level security;
revoke all on table private.signup_ticket_secret from public, anon, authenticated;

grant usage on schema private to supabase_auth_admin;
grant select on table private.signup_ticket_secret to supabase_auth_admin;
create policy signup_ticket_secret_auth_admin on private.signup_ticket_secret
  for select to supabase_auth_admin using (true);

create or replace function public.hook_require_signup_ticket(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  email text := lower(coalesce(event -> 'user' ->> 'email', ''));
  provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '');
  ticket text := coalesce(event -> 'user' -> 'user_metadata' ->> 'signup_ticket', '');
  parts text[] := string_to_array(ticket, '.');
  secret text;
  expires bigint;
  expected text;
  refusal jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'Create your account at accounts.roachnet.org.'));
begin
  if provider <> 'email' or email = '' then
    return refusal;
  end if;
  select s.secret into secret from private.signup_ticket_secret s where s.id;
  if secret is null or coalesce(array_length(parts, 1), 0) <> 3 or parts[1] <> 'v1' or parts[2] !~ '^[0-9]{9,11}$' then
    return refusal;
  end if;
  expires := parts[2]::bigint;
  if expires < extract(epoch from now())::bigint or expires > extract(epoch from now())::bigint + 900 then
    return refusal;
  end if;
  expected := encode(extensions.hmac('v1|' || email || '|' || parts[2], secret, 'sha256'), 'hex');
  if expected <> lower(parts[3]) then
    return refusal;
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_require_signup_ticket(jsonb) from public, anon, authenticated;
grant execute on function public.hook_require_signup_ticket(jsonb) to supabase_auth_admin;
