#!/usr/bin/env bash
#
# Deploy this repository to a server with Docker.
#
#   ./deploy.sh root@198.51.100.10    deploy to that host
#   ./deploy.sh                       deploy to the host you saved (see below)
#
# The script copies the source to the server, installs Docker if the server has
# none, dumps the database before touching anything, rebuilds the containers and
# checks that the API answers.
#
# It needs SSH access to the host (a key or an agent) and rsync locally.
#
# The host is taken from the first of these that is set:
#   1. the first argument
#   2. $RANKING_HOST
#   3. the file .deploy-host next to this script (one line, git ignores it)
#   4. HOST below, if you would rather keep it in the script

set -euo pipefail

# ---------------------------------------------------------------------------
# Optional: your own server, as user@host. Leave it empty to keep it out of git
# and use .deploy-host or an argument instead.
HOST=""
# ---------------------------------------------------------------------------

REMOTE_DIR="/opt/ranking"
BACKUP_DIR="/var/backups/ranking"
SSH_OPTS=(-o ConnectTimeout=20 -o ServerAliveInterval=15)

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -z "${1:-}" ] && [ -z "${RANKING_HOST:-}" ] && [ -z "$HOST" ] && [ -f "$LOCAL_DIR/.deploy-host" ]; then
  HOST=$(tr -d '[:space:]' < "$LOCAL_DIR/.deploy-host")
fi
HOST="${1:-${RANKING_HOST:-$HOST}}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
die() { printf '\n\033[31mError: %s\033[0m\n' "$1" >&2; exit 1; }

if [ -z "$HOST" ]; then
  die "No host. Run './deploy.sh user@host', or save it once with:
  echo 'root@198.51.100.10' > $LOCAL_DIR/.deploy-host"
fi
case "$HOST" in
  *@*) ;;
  *) die "HOST must be user@host, for example root@198.51.100.10" ;;
esac
command -v rsync >/dev/null || die "rsync is not installed locally."

remote() { ssh "${SSH_OPTS[@]}" "$HOST" "$@"; }

say "Checking $HOST"
remote true || die "Cannot reach $HOST over SSH."

if ! remote "command -v docker >/dev/null"; then
  say "Installing Docker on $HOST"
  remote "curl -fsSL https://get.docker.com | sh"
fi
remote "docker compose version >/dev/null" || die "Docker is installed but the compose plugin is missing."

say "Copying the source to $REMOTE_DIR"
remote "mkdir -p $REMOTE_DIR"
# --delete keeps the server free of files you removed locally. Backups live in
# $BACKUP_DIR, outside this path, so they survive it.
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
  --exclude node_modules --exclude dist --exclude .git --exclude .env \
  "$LOCAL_DIR/" "$HOST:$REMOTE_DIR/"

if ! remote "test -f $REMOTE_DIR/deploy/.env"; then
  remote "cp $REMOTE_DIR/deploy/.env.example $REMOTE_DIR/deploy/.env"
  cat <<EOF

The server had no deploy/.env, so the example was copied there. Fill it in, then
run this script again:

  ssh $HOST
  nano $REMOTE_DIR/deploy/.env     # API_DOMAIN, POSTGRES_PASSWORD, DISCORD_*

EOF
  exit 1
fi

if remote "docker ps --format '{{.Names}}' | grep -q '^deploy-postgres-1$'"; then
  say "Backing up the database"
  remote "mkdir -p $BACKUP_DIR && docker exec deploy-postgres-1 pg_dump -U ranking ranking \
    | gzip > $BACKUP_DIR/ranking-\$(date +%Y%m%d-%H%M%S).sql.gz"
  remote "ls -t $BACKUP_DIR/ranking-*.sql.gz | tail -n +11 | xargs -r rm --"
fi

say "Building and starting the containers"
remote "cd $REMOTE_DIR/deploy && docker compose up -d --build"

say "Waiting for the API"
DOMAIN="$(remote "grep -E '^API_DOMAIN=' $REMOTE_DIR/deploy/.env | cut -d= -f2-" | tr -d '\r')"
[ -n "$DOMAIN" ] || die "API_DOMAIN is not set in $REMOTE_DIR/deploy/.env"

for attempt in $(seq 1 30); do
  if remote "curl -fsS --max-time 5 https://$DOMAIN/api/health" 2>/dev/null | grep -q '"ok":true'; then
    say "Deployed: https://$DOMAIN"
    remote "cd $REMOTE_DIR/deploy && docker compose ps --format '{{.Name}}  {{.Status}}'"
    exit 0
  fi
  sleep 3
done

printf '\n'
remote "cd $REMOTE_DIR/deploy && docker compose ps --format '{{.Name}}  {{.Status}}' && docker compose logs --tail 40 api"
die "The API did not answer at https://$DOMAIN/api/health. On a first deploy Caddy needs up to a minute for the certificate; run the script again if the logs look healthy."
