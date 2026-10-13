#!/bin/zsh
# Manual backup of the RoachNet accounts database (Supabase Free has no automatic
# backups). Run it on the schedule in supabase/SECURITY.md.
#
#   scripts/supabase-backup.sh [--to DIR] [--keep N]
#
# It needs the database password. Store it once in the login Keychain and paste
# the password when asked (-U replaces an older one):
#   security add-generic-password -U -a "$USER" -s roachnet-supabase-db-url -w
# The item can hold the whole session-pooler connection string instead.
# $SUPABASE_DB_URL, when set, is used before the Keychain; with neither, the
# script asks for the password with a hidden prompt. The password is never
# printed, never written to disk, and never put on a command line other than
# the Supabase CLI's.
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
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
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

# The project's session pooler. None of this is secret (the project ref is in
# site-config.js). Override with SUPABASE_DB_HOST, _PORT, _USER or _NAME.
db_host=${SUPABASE_DB_HOST:-aws-1-us-east-1.pooler.supabase.com}
db_port=${SUPABASE_DB_PORT:-5432}
db_user=${SUPABASE_DB_USER:-postgres.yaiynvuvnnwbxaeoaseb}
db_name=${SUPABASE_DB_NAME:-postgres}
store_hint='  security add-generic-password -U -a "$USER" -s roachnet-supabase-db-url -w'

# Percent-encodes the password for the connection string, byte by byte.
urlencode() {
  emulate -L zsh
  setopt no_multibyte
  local s=$1 out= c
  local -i i
  for (( i = 1; i <= ${#s}; i++ )); do
    c=${s[i]}
    if [[ $c == [A-Za-z0-9._~-] ]]; then
      out+=$c
    else
      out+=%${(l:2::0:)$(( [##16] #c & 255 ))}
    fi
  done
  print -rn -- "$out"
}

# None of the checks below print the value.
secret=${SUPABASE_DB_URL:-}
from=env
if [[ -z "$secret" ]]; then
  secret=$(security find-generic-password -s roachnet-supabase-db-url -w 2>/dev/null || true)
  from=keychain
fi
if [[ -z "$secret" ]]; then
  print -nu2 "Database password (typing is hidden): "
  read -rs secret || true
  print -u2
  from=prompt
fi
[[ -n "$secret" ]] || { print -u2 "No database password given."; exit 1 }
if [[ "$secret" == *YOUR-PASSWORD* ]]; then
  print -u2 "That still has the [YOUR-PASSWORD] placeholder in it. Store the password itself:"
  print -u2 -- "$store_hint"
  exit 1
fi
# Every form the password can take, so none of them reaches the terminal or a log.
secrets=()
if [[ "$secret" == postgres(|ql)://* ]]; then
  db_url=$secret
  userinfo=${${secret#*://}%@*}
  if [[ "$userinfo" == *:* ]]; then
    pw_seg=${userinfo#*:}
    printf -v pw_dec '%b' "${pw_seg//\%/\\x}"
    secrets+=("$pw_seg" "$pw_dec")
    unset pw_seg pw_dec
  fi
  unset userinfo
elif [[ "$secret" == *://* || $from == env ]]; then
  print -u2 "That isn't a postgres:// connection string. Store the database password (or the whole"
  print -u2 "session-pooler connection string) with:"
  print -u2 -- "$store_hint"
  exit 1
elif [[ "$secret" == [[:space:]]* || "$secret" == *[[:space:]] ]]; then
  print -u2 "The password starts or ends with a space, which is usually a copying slip. Store it again with:"
  print -u2 -- "$store_hint"
  exit 1
else
  encoded=$(urlencode "$secret")
  secrets+=("$secret" "$encoded")
  db_url="postgresql://$db_user:$encoded@$db_host:$db_port/$db_name"
  unset encoded
fi
unset secret

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
# The CLI's own messages can quote the connection string. Neither it nor the
# password gets through to the terminal or a log. Lines pass straight through
# (sed -l), so the first run's image download shows its progress.
redact() {
  local line s
  while IFS= read -r line || [[ -n "$line" ]]; do
    for s in $secrets; do line=${line//"$s"/[password]}; done
    print -r -- "$line"
  done
}
dump() {
  supabase db dump --db-url "$db_url" "$@" 2>&1 |
    sed -l -E 's#(postgres(ql)?://[^:/@[:space:]]+):[^@[:space:]]*@#\1:[password]@#g' | redact
}
dump -f "$out/roles.sql" --role-only || fail "The roles dump failed."
dump -f "$out/schema.sql" || fail "The schema dump failed."
dump -f "$out/data.sql" --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes" || fail "The data dump failed."
unset db_url secrets

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
