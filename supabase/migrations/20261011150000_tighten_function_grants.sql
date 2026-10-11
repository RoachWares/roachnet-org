-- Database advisor follow-up (2026-10-11).
--
-- Trigger and event-trigger functions fire without any EXECUTE grant, so
-- nobody needs to call these two over the REST API (/rest/v1/rpc/...).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.sync_profile_from_auth_user() from public, anon, authenticated;

-- touch_device_link is for signed-in clients only; it raises without auth.uid().
revoke execute on function public.touch_device_link(text, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.touch_device_link(text, text, text, text, text, text, text, jsonb) to authenticated;

-- A fixed, empty search_path for the updated_at trigger (it only calls
-- pg_catalog functions, which are always on the path).
alter function public.set_row_updated_at() set search_path = '';
