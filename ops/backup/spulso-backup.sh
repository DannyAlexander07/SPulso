#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${SPULSO_APP_DIR:-/opt/spulso/app}"
ENV_FILE="${SPULSO_ENV_FILE:-/opt/spulso/app/.env.production}"
BACKUP_DIR="${SPULSO_BACKUP_DIR:-/var/backups/spulso}"
RETENTION_DAYS="${SPULSO_BACKUP_RETENTION_DAYS:-14}"
COMPOSE_FILE="${APP_DIR}/docker-compose.production.yml"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_DIR}/${STAMP}"

umask 077
test -f "${COMPOSE_FILE}"
test -f "${ENV_FILE}"
install -d -m 0700 "${TARGET_DIR}"

compose=(docker compose --project-directory "${APP_DIR}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

"${compose[@]}" exec -T postgres sh -c \
  'exec pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" "$POSTGRES_DB"' \
  > "${TARGET_DIR}/postgres.dump"

"${compose[@]}" exec -T api sh -c \
  'cd /app/apps/api/uploads && exec tar -czf - .' \
  > "${TARGET_DIR}/uploads.tar.gz"

docker run --rm -i postgres:16 pg_restore --list \
  < "${TARGET_DIR}/postgres.dump" >/dev/null
tar -tzf "${TARGET_DIR}/uploads.tar.gz" >/dev/null
sha256sum "${TARGET_DIR}/postgres.dump" "${TARGET_DIR}/uploads.tar.gz" \
  > "${TARGET_DIR}/SHA256SUMS"

if [[ -n "${SPULSO_RCLONE_REMOTE:-}" ]]; then
  command -v rclone >/dev/null
  rclone copy "${TARGET_DIR}" "${SPULSO_RCLONE_REMOTE%/}/${STAMP}" \
    --checksum --immutable
fi

find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d \
  -mtime "+${RETENTION_DAYS}" -print0 | xargs -0r rm -rf --

printf 'SPulso backup verified: %s\n' "${TARGET_DIR}"
