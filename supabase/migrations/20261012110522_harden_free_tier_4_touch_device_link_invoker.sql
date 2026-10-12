-- Free-tier hardening, part 4 of 6 (applied 2026-10-12).
--
-- touch_device_link no longer runs as its owner. As security invoker it is
-- bound by the caller's RLS policies and column grants, like a direct upsert.
-- It also validates its input and clamps text to the column limits.
create or replace function public.touch_device_link(
  p_device_id text,
  p_device_name text default null,
  p_platform text default null,
  p_runtime_lane text default 'paired',
  p_roachtail_peer_id text default null,
  p_roachsync_device_id text default null,
  p_roachsync_folder_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.device_links
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  upserted public.device_links;
begin
  if current_user_id is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if p_device_id is null or char_length(p_device_id) not between 1 and 128 then
    raise exception 'device id is missing or too long' using errcode = '22023';
  end if;
  if p_metadata is not null and jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'metadata must be an object' using errcode = '22023';
  end if;

  insert into public.device_links (
    user_id, device_id, device_name, platform, runtime_lane,
    roachtail_peer_id, roachsync_device_id, roachsync_folder_id, metadata, last_seen_at
  )
  values (
    current_user_id,
    p_device_id,
    left(coalesce(nullif(p_device_name, ''), 'RoachNet device'), 120),
    left(coalesce(nullif(p_platform, ''), 'unknown'), 40),
    left(coalesce(nullif(p_runtime_lane, ''), 'paired'), 40),
    nullif(p_roachtail_peer_id, ''),
    nullif(p_roachsync_device_id, ''),
    nullif(p_roachsync_folder_id, ''),
    coalesce(p_metadata, '{}'::jsonb),
    timezone('utc', now())
  )
  on conflict (user_id, device_id) do update
    set device_name = excluded.device_name,
        platform = excluded.platform,
        runtime_lane = excluded.runtime_lane,
        roachtail_peer_id = coalesce(excluded.roachtail_peer_id, public.device_links.roachtail_peer_id),
        roachsync_device_id = coalesce(excluded.roachsync_device_id, public.device_links.roachsync_device_id),
        roachsync_folder_id = coalesce(excluded.roachsync_folder_id, public.device_links.roachsync_folder_id),
        metadata = public.device_links.metadata || excluded.metadata,
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
  returning * into upserted;

  return upserted;
end;
$$;

revoke all on function public.touch_device_link(text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.touch_device_link(text, text, text, text, text, text, text, jsonb) to authenticated;
