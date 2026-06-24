#!/bin/sh
set -eu

PROJECT_DIR="${PROJECT_DIR:-/opt/sit-checkin}"

cd "$PROJECT_DIR"

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Defina ADMIN_PASSWORD no ambiente ou em $PROJECT_DIR/.env antes do deploy." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-30}"

mkdir -p "$BACKUP_DIR"

if [ -f participantes.db ]; then
  backup_file="$BACKUP_DIR/participantes-deploy-$(date +%Y%m%d-%H%M%S).db"
  cp participantes.db "$backup_file"
  echo "Backup criado: $backup_file"
else
  echo "participantes.db ainda nao existe; seguindo sem backup."
fi

ls -1t "$BACKUP_DIR"/participantes-*.db 2>/dev/null | awk "NR > $BACKUP_RETENTION" | xargs -r rm -f

git pull origin main
APP_VERSION="$(git rev-parse --short HEAD)"
APP_BUILD_TIME="$(date -Iseconds)"
export APP_VERSION APP_BUILD_TIME
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}" ADMIN_PASSWORD="$ADMIN_PASSWORD" docker compose --profile worker up -d --build --force-recreate app print-worker
