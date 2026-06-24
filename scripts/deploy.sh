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

mkdir -p "$BACKUP_DIR"

if [ -f participantes.db ]; then
  backup_file="$BACKUP_DIR/participantes-deploy-$(date +%Y%m%d-%H%M%S).db"
  cp participantes.db "$backup_file"
  echo "Backup criado: $backup_file"
else
  echo "participantes.db ainda nao existe; seguindo sem backup."
fi

git pull origin main
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}" ADMIN_PASSWORD="$ADMIN_PASSWORD" docker compose up -d --build app
