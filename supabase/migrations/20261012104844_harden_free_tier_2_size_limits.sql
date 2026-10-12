-- Free-tier hardening, part 2 of 6 (applied 2026-10-12).
--
-- Input validation in the database. The Free plan has no per-route request
-- size limits, so oversized rows are refused here instead.
alter table public.profiles
  add constraint profiles_display_name_len check (display_name is null or char_length(display_name) <= 80),
  add constraint profiles_avatar_url_shape check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://'));

alter table public.user_settings
  add constraint user_settings_settings_size check (pg_column_size(settings) <= 32768),
  add constraint user_settings_app_state_size check (pg_column_size(app_state) <= 65536),
  add constraint user_settings_favorites_count check (cardinality(favorite_apps) <= 500);

alter table public.device_links
  add constraint device_links_text_len check (
    char_length(device_id) <= 128 and char_length(device_name) <= 120 and char_length(platform) <= 40
    and char_length(runtime_lane) <= 40
    and coalesce(char_length(roachtail_peer_id), 0) <= 128
    and coalesce(char_length(roachsync_device_id), 0) <= 128
    and coalesce(char_length(roachsync_folder_id), 0) <= 128),
  add constraint device_links_metadata_size check (pg_column_size(metadata) <= 8192);

alter table public.saved_apps
  add constraint saved_apps_text_len check (
    char_length(app_id) <= 200 and char_length(title) <= 200 and coalesce(char_length(category), 0) <= 80
    and char_length(source) <= 200),
  add constraint saved_apps_intent_size check (pg_column_size(install_intent) <= 8192);

alter table public.chat_threads
  add constraint chat_threads_text_len check (
    char_length(title) <= 200 and coalesce(char_length(summary), 0) <= 2000
    and char_length(lane) <= 40 and char_length(source) <= 200),
  add constraint chat_threads_metadata_size check (pg_column_size(metadata) <= 16384);

alter table public.chat_messages
  add constraint chat_messages_text_len check (
    char_length(content) <= 32000 and coalesce(char_length(provider), 0) <= 80
    and coalesce(char_length(model), 0) <= 120),
  add constraint chat_messages_metadata_size check (pg_column_size(metadata) <= 16384);
