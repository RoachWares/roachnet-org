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

1. Take a backup first (`scripts/supabase-backup.sh`, below); the schedule asks for one before any change to auth hooks.
2. Dashboard › Authentication › Hooks › add **Before User Created**: switch it on, hook type Postgres, schema `public`, function `hook_require_signup_ticket`, then **Create hook**.
3. Create an account at accounts.roachnet.org with an address you control. It should succeed and send the confirmation email. Delete the test account afterwards if you don't want it.
4. If step 3 says "Create your account at accounts.roachnet.org.", the ticket didn't match. Turn the hook off again (same screen), and sign-ups work as before while it's looked at.
5. Check that the hook really ran: `pg_stat_statements` should show calls of `hook_require_signup_ticket` by `supabase_auth_admin`, and `auth.users` one more row.
6. Optional negative check: a direct `POST /auth/v1/signup` with the public key and no ticket should return 403 with that same message, and create no user.

#### Result, 2026-10-13

The hook was turned on at 01:36 UTC and works.

- Between 01:38 and 01:39 the auth server saw 8 sign-up attempts from `register-account`. Supabase's gateway retries a request that times out, so they came from fewer clicks.
- For each attempt, the auth log says the hook ran and let it through, and `pg_stat_statements` shows the 8 calls by `supabase_auth_admin` (6 ms on average).
- So the Netlify and database ticket secrets match, and the ticket arrives in `user.user_metadata`.

The sign-ups themselves didn't finish, for a reason that has nothing to do with the hook:

- Each attempt's database work took milliseconds: the user and identity rows were written.
- Six of the eight then ran into Supabase's 10-second limit (504 `request_timeout`); the other two ended just past it. None of the accounts was kept: `auth.users` has no new rows.
- With the gateway's retries, a click took about 35 seconds to fail. The browser showed "Could not reach the sign-in service."

The wait comes after the database work. In a sign-up, that's when the confirmation email goes out, so email delivery is the likely cause; see [Email delivery](#email-delivery). The hook stays on. It finishes in milliseconds, so turning it off wouldn't help.

On `site/mission-palettes` (not deployed yet), `register-account` gives up on Supabase after 15 seconds. It answers plainly ("Sign-up is slow on our side right now…") instead of leaving the browser to time out, and it turns Supabase's 5xx wording into messages written for people.

## Email delivery

Public sign-ups need email that works. The confirmation email is sent inside the sign-up, so when sending stalls or fails, the account isn't created.

Supabase's built-in email service is not meant for production ([Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)):

- It only delivers to the addresses of the project's team members.
- It allows a few messages an hour.
- It has no delivery guarantee.

Before launch:

1. Check Dashboard › Authentication › Emails › SMTP Settings. Either custom SMTP is off (the built-in service), or a configured server isn't answering.
2. Set up a custom SMTP sender for the roachnet.org domain:
   - choose a provider (Supabase lists Resend, AWS SES, Postmark and others);
   - add its SPF and DKIM DNS records;
   - put its SMTP host, port, user and password in that screen, with a `no-reply@` From address.
3. Raise the email rate limit under Authentication › Rate Limits to fit.
4. Sign up once more and check that the confirmation email arrives and its link works.

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

You need three things:

- The Supabase CLI (`brew install supabase/tap/supabase`).
- Docker running (OrbStack or Docker Desktop).
- The database password, stored once in the login Keychain.

To store it, or to replace it after a reset (`-U` replaces the old one), run this and paste the password at the prompt. Paste it only there, never into a chat, an issue or a file:

```sh
security add-generic-password -U -a "$USER" -s roachnet-supabase-db-url -w
```

The script builds the session-pooler connection string itself. The item can hold the whole string from the dashboard's Connect panel instead, with the password in place of `[YOUR-PASSWORD]`.

The database password should be long and random. Supabase's **Reset database password** can generate one. The Supabase CLI and this script are the only things that need it; the sites use API keys, not the database password.

Then:

```sh
scripts/supabase-backup.sh --keep 8        # writes ~/RoachNet-Backups/supabase/<UTC stamp>/
scripts/supabase-backup.sh --to /Volumes/EncryptedBackups/supabase
```

What the script does:

- It takes a connection string from `$SUPABASE_DB_URL`, or else the password (or the whole string) from the Keychain item or a hidden prompt. It never prints the password or writes it to a file, and it filters the CLI's messages so the password can't reach the terminal or a log.
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
| 2026-10-13 01:23 | First manual backup, before turning on the sign-up hook: roles, schema and data (60 KB) | `SHA256SUMS` verifies. `auth.users` has the same row count as the live project. The schema has the hook function, row-level security on the same 7 tables, and the same 21 policies. `roles.sql` holds no role passwords | Not yet |
| 2026-10-13 01:47 | Manual, checking the re-stored Keychain item (password only) after the reset (60 KB) | `SHA256SUMS` verifies, `auth.users` matches live, 21 policies | Not yet |

## Checking it

- `npm run verify` runs the function tests, including the breached-password and ticket tests and the no-service-role check.
- The project's security advisor should list only leaked-password protection (Pro).
- A direct `POST /auth/v1/signup` with the public key, once the hook is on, should return 403 "Create your account at accounts.roachnet.org."
