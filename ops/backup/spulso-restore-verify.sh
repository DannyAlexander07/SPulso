#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_FILE="${1:?Uso: spulso-restore-verify.sh /ruta/postgres.dump}"
CONTAINER="spulso-restore-check-$$"
PASSWORD="$(openssl rand -hex 24)"

test -f "${BACKUP_FILE}"
docker run --rm -i postgres:16 pg_restore --list < "${BACKUP_FILE}" >/dev/null

cleanup() {
  docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "${CONTAINER}" \
  -e POSTGRES_PASSWORD="${PASSWORD}" postgres:16 >/dev/null

for _ in $(seq 1 40); do
  if docker exec "${CONTAINER}" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "${CONTAINER}" pg_isready -U postgres >/dev/null
docker exec "${CONTAINER}" createdb -U postgres spulso_restore
docker exec -i "${CONTAINER}" pg_restore \
  -U postgres -d spulso_restore --no-owner --no-acl < "${BACKUP_FILE}"
docker exec "${CONTAINER}" psql -U postgres -d spulso_restore \
  -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN COUNT(*) > 0 THEN 'restore-ok' ELSE 'restore-empty' END FROM \"_prisma_migrations\";"
