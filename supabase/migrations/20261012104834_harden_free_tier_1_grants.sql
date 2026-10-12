-- Free-tier hardening, part 1 of 6 (applied 2026-10-12).
--
-- Least privilege on the six public tables. RLS already limits rows to the
-- owner; these grants also limit which columns a signed-in client may write,
-- so a client can't set user_id, plan, created_at and similar columns itself.
-- anon gets nothing: every table here belongs to a signed-in person.
revoke all on table public.profiles, public.user_settings, public.device_links,
  public.saved_apps, public.chat_threads, public.chat_messages from anon;
revoke all on table public.profiles, public.user_settings, public.device_links,
  public.saved_apps, public.chat_threads, public.chat_messages from authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

grant select on table public.user_settings to authenticated;
grant update (settings, favorite_apps, app_state) on table public.user_settings to authenticated;

grant select, delete on table public.device_links to authenticated;
grant insert (user_id, device_id, device_name, platform, runtime_lane, roachtail_peer_id,
              roachsync_device_id, roachsync_folder_id, metadata, last_seen_at)
  on table public.device_links to authenticated;
grant update (device_name, platform, runtime_lane, roachtail_peer_id, roachsync_device_id,
              roachsync_folder_id, metadata, last_seen_at, updated_at)
  on table public.device_links to authenticated;

grant select, insert, update, delete on table public.saved_apps to authenticated;
grant select, insert, update, delete on table public.chat_threads to authenticated;
grant select, insert on table public.chat_messages to authenticated;
