-- Free-tier hardening, part 3 of 6 (applied 2026-10-12).
--
-- Per-account row caps, so one account can't fill the 500 MB Free database.
-- The function runs as the caller (security invoker), so its count only sees
-- the caller's own rows through RLS. With a key column, an insert that the
-- client will turn into an update (upsert on that key) passes even at the cap.
--
-- The live project's copy of this migration also starts with
--   revoke all on function public.rn_probe_noop() from public, anon, authenticated;
-- That function was left over from a one-off probe made outside migrations, so
-- the line is left out here: on a fresh database the function doesn't exist.
create or replace function public.enforce_row_cap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cap integer := tg_argv[0]::integer;
  key_column text := case when tg_nargs > 1 then tg_argv[1] else null end;
  existing integer;
  found_key boolean;
begin
  if key_column is not null then
    execute format('select exists (select 1 from %I.%I where user_id = %L and %I = %L)',
                   tg_table_schema, tg_table_name, new.user_id, key_column, to_jsonb(new) ->> key_column)
      into found_key;
    if found_key then
      return new;
    end if;
  end if;
  execute format('select count(*) from %I.%I where user_id = %L', tg_table_schema, tg_table_name, new.user_id)
    into existing;
  if existing >= cap then
    raise exception 'This account has reached its limit of % % rows.', cap, tg_table_name
      using errcode = 'P0001', hint = 'Remove some, then try again.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_row_cap() from public, anon, authenticated;

create trigger device_links_row_cap before insert on public.device_links
  for each row execute function public.enforce_row_cap('50', 'device_id');
create trigger saved_apps_row_cap before insert on public.saved_apps
  for each row execute function public.enforce_row_cap('1000', 'app_id');
create trigger chat_threads_row_cap before insert on public.chat_threads
  for each row execute function public.enforce_row_cap('500');
create trigger chat_messages_row_cap before insert on public.chat_messages
  for each row execute function public.enforce_row_cap('10000');
