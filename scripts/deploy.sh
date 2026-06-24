#!/bin/sh
set -eu

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "Defina ADMIN_PASSWORD antes do deploy." >&2
  exit 1
fi

PROJECT_DIR="${PROJECT_DIR:-/opt/sit-checkin}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"

cd "$PROJECT_DIR"
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
