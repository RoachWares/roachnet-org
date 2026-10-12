# RoachNet accounts on the Supabase Free plan

RoachNet accounts (accounts.roachnet.org, web RoachClaw, saved apps, device links) run on one Supabase project on the Free plan. This page lists what protects that data today, what the Free plan doesn't give us, and what stands in for it. It describes the state after the 2026-10-12 hardening migrations (`20261012104834` to `20261012110606`).

Nothing here makes the Free plan equal to Pro. Where a Pro-only control is missing, this page says so.

## What is in place

| Area | Control | Where |
| --- | --- | --- |
| Row access | Row Level Security on every public table; each policy limits rows to `auth.uid()` | `20260408215248_roachnet_account_lane.sql`, `20260409030118_roachclaw_web_chat_lane.sql` |
| Column access | `anon` has no table rights. `authenticated` can only write the columns a client should set (no `user_id` rewrites, no `plan`, no timestamps it shouldn't own) | `…_1_grants.sql` |
| Input size | CHECK constraints on text length and JSON size in every table | `…_2_size_limits.sql` |
| Storage abuse | Per-account row caps: 50 devices, 1,000 saved apps, 500 threads, 10,000 messages | `…_3_row_caps.sql` |
| Functions | No `SECURITY DEFINER` function is callable over the REST API. `touch_device_link` runs as the caller and validates its input. Every function has a fixed `search_path` | `20261011150000_tighten_function_grants.sql`, `…_4_touch_device_link_invoker.sql` |
| Sign-up | Sign-ups go through `register-account` on roachnet.org: origin check, honeypot, Turnstile, two rate limits, breached-password check, then `/auth/v1/signup` with the public key | `netlify/functions/register-account.mjs` |
| Sign-up bypass | A Before User Created hook refuses email sign-ups that don't carry a 10-minute HMAC ticket from `register-account`, so calling `/auth/v1/signup` directly skips nothing | `…_5_signup_ticket_hook.sql`, `…_6_hook_extensions_usage.sql` |
| Service role | Neither Netlify function uses the service-role key. Web chat reads and writes with the person's own session token, so RLS applies | `netlify/functions/roachclaw-chat.mjs`, `test/site-outcomes.mjs` |
| Secrets | The Turnstile secret and the sign-up ticket secret live only in Netlify env (functions scope). The ticket secret's database copy is in `private.signup_ticket_secret`, readable only by `supabase_auth_admin` | — |
| Errors | Database error details stay in the function logs; clients get a short message | `roachclaw-chat.mjs` |

The sign-up hook does nothing until it is switched on: Dashboard › Authentication › Hooks › Before User Created › Postgres function `public.hook_require_signup_ticket`. Switch it on only after `ROACHNET_SIGNUP_TICKET_SECRET` is set on the roachnet.org Netlify site and that deploy is live, or every sign-up is refused.

## What the Free plan doesn't give us

| Missing on Free | Effect | What we do instead | Still not covered |
| --- | --- | --- | --- |
| Leaked-password protection (Pro) | Supabase doesn't check passwords against breach lists | `register-account` checks Have I Been Pwned's range API at sign-up. Only the first 5 characters of the password's SHA-1 leave the function, with padding on | Password changes and resets in the account page aren't checked. If the range API is down, sign-up goes ahead (logged) |
| Daily backups and point-in-time recovery (Pro) | No restore point if data is lost or a migration goes wrong | The manual dump below, kept off-site | Anything written between dumps |
| Password Verification hook (Team) | No server-side lockout after repeated wrong passwords | Supabase's built-in auth rate limits (configurable on Free) | Slow, distributed guessing within those limits |
| Log retention (1 day on Free) | Auth and API logs are gone after a day | Netlify function logs for the two functions | A longer audit trail |
| Always-on project | Free projects pause after a week with no activity | — | A paused project means sign-in and web chat are down until it is resumed |
| Custom domain and SSO | — | Not needed today | — |

Supabase Auth's own CAPTCHA setting isn't turned on. Turnstile is checked in `register-account`, and once the hook is on, that's the only way to create an account. Password sign-in itself has no CAPTCHA.

## Manual backup

This follows Supabase's [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) guide. It needs the Supabase CLI, Docker Desktop running, and the database password (Dashboard › Project Settings › Database). Keep the output outside every git repo.

```sh
mkdir -p ~/RoachNet-Backups/supabase && cd ~/RoachNet-Backups/supabase
stamp=$(date -u +%Y%m%dT%H%M%SZ)
supabase db dump --db-url "$SUPABASE_DB_URL" -f "roles-$stamp.sql" --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f "schema-$stamp.sql"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "data-$stamp.sql" --use-copy --data-only \
  -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

`SUPABASE_DB_URL` is the session-pooler connection string from the dashboard's Connect panel. Set it in the shell for that session only; don't save it in a file.

The data dump holds account emails, password hashes, chat history and the sign-up ticket secret. Store it encrypted (an encrypted APFS volume or disk image), keep it off-site, and delete old dumps on a schedule. Before trusting a dump, check that it contains `auth.users` rows.

To restore, create a new project and run:

```sh
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_DB_URL"
```

Dashboard settings aren't in the dump. After a restore, set the Before User Created hook, the auth URLs and the rate limits again, and point the Netlify env at the new project. Test a restore at least once before relying on it.

## Checking it

- `npm run verify` runs the function tests, including the breached-password and ticket tests and the no-service-role check.
- The project's security advisor should list only leaked-password protection (Pro).
- A direct `POST /auth/v1/signup` with the public key, once the hook is on, should return 403 "Create your account at accounts.roachnet.org."
