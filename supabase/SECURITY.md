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

### Turning the sign-up hook on

Checked on 2026-10-12, before turning it on:

- The live roachnet.org deploy carries the ticket code: `register-account` answers 403 to another origin and 400 to an empty form.
- `private.signup_ticket_secret` has one row of at least 32 characters. Only `supabase_auth_admin` can read it, and only it can run the hook; `anon` and `authenticated` can do neither.
- The hook was run directly on ten made-up events:
  - a valid ticket passes, including when the email is typed in capitals;
  - it refuses a ticket for another email, no ticket, an expired ticket, an expiry more than 15 minutes ahead, a ticket signed with another key, a ticket with one hex digit changed, a non-email provider, and a malformed ticket.

Not checked, because it needs a real account: that Supabase hands the hook the `signup_ticket` that `register-account` puts in the sign-up's `data` (it should arrive as `user.user_metadata`). Nor whether the Netlify secret and the database secret are the same value; neither can be read back.

So turn it on and test it in one sitting:

1. Dashboard › Authentication › Hooks › **Before User Created** › Postgres, function `public.hook_require_signup_ticket` › Enable.
2. Create an account at accounts.roachnet.org with an address you control. It should succeed and send the confirmation email. Delete the test account afterwards if you don't want it.
3. If step 2 says "Create your account at accounts.roachnet.org.", the ticket didn't match. Turn the hook off again (same screen), and sign-ups work as before while it's looked at.
4. Optional negative check: a direct `POST /auth/v1/signup` with the public key and no ticket should return 403 with that same message, and create no user.

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

Supabase backs up only Pro, Team and Enterprise projects. For Free projects it recommends regular `supabase db dump` exports kept off-site ([Database Backups](https://supabase.com/docs/guides/platform/backups)). `scripts/supabase-backup.sh` does that, following Supabase's [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) guide.

### Schedule

| When | What |
| --- | --- |
| Every Monday | `scripts/supabase-backup.sh --keep 8` (eight weeks of dumps) |
| Before every migration, and before changing auth hooks or settings | `scripts/supabase-backup.sh` |
| First Monday of the month | Copy the newest dump to the encrypted off-site location, and keep twelve monthly copies there |
| Every three months | Restore the newest dump into a throwaway project and check that the accounts and chats are there (below) |

### Running it

It needs the Supabase CLI (`brew install supabase/tap/supabase`), Docker Desktop running, and the session-pooler connection string from the dashboard's Connect panel. Store that string once in the login Keychain:

```sh
security add-generic-password -a "$USER" -s roachnet-supabase-db-url -w
```

Then:

```sh
scripts/supabase-backup.sh --keep 8        # writes ~/RoachNet-Backups/supabase/<UTC stamp>/
scripts/supabase-backup.sh --to /Volumes/EncryptedBackups/supabase
```

What the script does:

- It reads the connection string from `$SUPABASE_DB_URL`, the Keychain item, or a hidden prompt. It never writes the string to a file.
- It refuses to write inside a git repository. Files are owner-only, and it warns when FileVault is off.
- It dumps the roles, the schema and the data.
- It fails if any file is empty or the data has no `auth.users` rows, and writes `SHA256SUMS`.
- With `--keep N`, it removes its own dated folders past the newest N.

The data dump holds account emails, password hashes, chat history and the sign-up ticket secret. Keep it on an encrypted volume, and keep the off-site copy encrypted too.

### Restoring

To restore, create a new project and run (`psql` comes with `brew install libpq`):

```sh
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_DB_URL"
```

Dashboard settings aren't in the dump. After a restore, set the Before User Created hook, the auth URLs and the rate limits again, and point the Netlify env at the new project. Test a restore at least once before relying on it.

For the quarterly test, restore into a throwaway Free project rather than the live one. A Free organization can hold two active projects. Check:

- `select count(*) from auth.users` matches the live count;
- a recent chat thread is there.

Then delete the throwaway project.

### Backup log

| Date (UTC) | Kind | Checked | Off-site |
| --- | --- | --- | --- |
| — | No backup yet | — | — |

## Checking it

- `npm run verify` runs the function tests, including the breached-password and ticket tests and the no-service-role check.
- The project's security advisor should list only leaked-password protection (Pro).
- A direct `POST /auth/v1/signup` with the public key, once the hook is on, should return 403 "Create your account at accounts.roachnet.org."
