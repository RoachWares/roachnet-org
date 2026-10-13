#!/bin/zsh
# Manual backup of the RoachNet accounts database (Supabase Free has no automatic
# backups). Run it on the schedule in supabase/SECURITY.md.
#
#   scripts/supabase-backup.sh [--to DIR] [--keep N]
#
# The connection string comes from, in order: $SUPABASE_DB_URL, the login Keychain
# item "roachnet-supabase-db-url" (add it once with
#   security add-generic-password -a "$USER" -s roachnet-supabase-db-url -w
# and paste the session-pooler URI when asked), or a hidden prompt. It is never
# written to disk or put on a command line other than the Supabase CLI's.
#
# Needs the Supabase CLI (brew install supabase/tap/supabase) and Docker running.
# The dump holds account emails, password hashes, chats and the sign-up ticket
# secret, so it is written owner-only, never inside a git repo, and should live on
# an encrypted volume with an encrypted off-site copy.
setopt ERR_EXIT NO_UNSET PIPE_FAIL
umask 077

dest="$HOME/RoachNet-Backups/supabase"
keep=0
while (( $# )); do
  case "$1" in
    --to) dest="$2"; shift 2 ;;
    --keep) keep="$2"; shift 2 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) print -u2 "Unknown option: $1"; exit 2 ;;
  esac
done
[[ "$keep" == <-> ]] || { print -u2 -- "--keep takes a number"; exit 2 }

command -v supabase >/dev/null || { print -u2 "Install the Supabase CLI first: brew install supabase/tap/supabase"; exit 1 }
# The CLI runs pg_dump in a container. OrbStack's socket is used directly when
# the current Docker context points somewhere that isn't running.
if ! docker info >/dev/null 2>&1; then
  if [[ -z "${DOCKER_HOST:-}" && -S "$HOME/.orbstack/run/docker.sock" ]]; then
    export DOCKER_HOST="unix://$HOME/.orbstack/run/docker.sock"
  fi
  docker info >/dev/null 2>&1 || { print -u2 "Start Docker (OrbStack or Docker Desktop) first; the Supabase CLI dumps through it."; exit 1 }
fi

probe=${dest:a}
while [[ ! -d "$probe" ]]; do probe=${probe:h}; done
if git -C "$probe" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  print -u2 "Refusing to write a database dump inside a git repository: ${dest:a}"
  exit 1
fi
mkdir -p "$dest"
dest=${dest:A}
if [[ "$(fdesetup status 2>/dev/null)" != *"On"* ]] && [[ "$dest" == "$HOME"* ]]; then
  print -u2 "Warning: FileVault is off, so this dump sits unencrypted on disk. Use --to with an encrypted volume."
fi

db_url=${SUPABASE_DB_URL:-}
if [[ -z "$db_url" ]]; then
  db_url=$(security find-generic-password -s roachnet-supabase-db-url -w 2>/dev/null || true)
fi
if [[ -z "$db_url" ]]; then
  read -rs "db_url?Supabase session-pooler connection string: "
  print
fi
[[ "$db_url" == postgres*://* ]] || { print -u2 "That doesn't look like a postgres:// connection string."; exit 1 }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$dest/$stamp"
mkdir -m 700 "$out"
# A run that stops part-way leaves no half-written dump of account data behind.
fail() {
  print -u2 -- "$1"
  rm -rf -- "$out"
  print -u2 "Removed the incomplete backup folder."
  exit 1
}
trap 'fail "Interrupted."' INT TERM HUP
print "Backing up to $out"
# The CLI's own messages can quote the connection string; the password never reaches the terminal or a log.
dump() {
  supabase db dump --db-url "$db_url" "$@" 2>&1 | sed -E 's#(postgres(ql)?://[^:/@[:space:]]+):[^@[:space:]]*@#\1:[password]@#g'
}
dump -f "$out/roles.sql" --role-only || fail "The roles dump failed."
dump -f "$out/schema.sql" || fail "The schema dump failed."
dump -f "$out/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes" || fail "The data dump failed."
unset db_url

# A dump without the accounts in it is not a backup.
for file in roles schema data; do
  [[ -s "$out/$file.sql" ]] || fail "$file.sql is empty; this backup failed."
done
grep -q '^COPY "auth"."users"' "$out/data.sql" || grep -q '^COPY auth.users' "$out/data.sql" ||
  fail "data.sql has no auth.users rows; this backup failed."
(cd "$out" && shasum -a 256 roles.sql schema.sql data.sql > SHA256SUMS) || fail "Couldn't write SHA256SUMS."
chmod 600 "$out"/*
trap - INT TERM HUP
print "Done: $(du -sh "$out" | cut -f1). Checksums are in SHA256SUMS."

if (( keep > 0 )); then
  # Only this script's own dated folders, newest first; everything past the newest $keep goes.
  backups=("$dest"/<->T<->Z(N/On))
  for folder in ${backups[$((keep + 1)),-1]}; do
    print "Removing old backup ${folder:t}"
    rm -rf -- "$folder"
  done
fi
print "Copy $out to the encrypted off-site location, then note the date in supabase/SECURITY.md's backup log."
