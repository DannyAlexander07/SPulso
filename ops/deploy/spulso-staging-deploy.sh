#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${SPULSO_APP_DIR:-/opt/spulso/app}"
ENV_FILE="${SPULSO_ENV_FILE:-${APP_DIR}/.env.production}"
COMPOSE_FILE="${APP_DIR}/docker-compose.production.yml"

if [[ "$(id -u)" -ne 0 ]]; then
  printf 'Este despliegue debe ejecutarse como root.\n' >&2
  exit 1
fi

test -f "${ENV_FILE}"
runuser -u spulso -- git -C "${APP_DIR}" pull --ff-only origin main

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${ENV_FILE}"
  fi
}

set_env JWT_EXPIRES_IN 2h
set_env EMAIL_DELIVERY_MODE smtp
set_env MALWARE_SCAN_MODE clamav
set_env CLAMAV_HOST clamav
set_env CLAMAV_PORT 3310
set_env CLAMAV_TIMEOUT_MS 15000

compose=(docker compose --project-directory "${APP_DIR}" --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
"${compose[@]}" config --quiet
"${compose[@]}" pull clamav
"${compose[@]}" build --pull api worker web
"${compose[@]}" run --rm --no-deps api npm run db:migrate:deploy
"${compose[@]}" up -d --remove-orphans

install -m 0755 "${APP_DIR}/ops/backup/spulso-backup.sh" /usr/local/sbin/spulso-backup
install -m 0755 "${APP_DIR}/ops/backup/spulso-restore-verify.sh" /usr/local/sbin/spulso-restore-verify
install -m 0755 "${APP_DIR}/ops/monitoring/spulso-health-check.sh" /usr/local/sbin/spulso-health-check
install -m 0644 "${APP_DIR}/ops/systemd/spulso-backup.service" /etc/systemd/system/spulso-backup.service
install -m 0644 "${APP_DIR}/ops/systemd/spulso-backup.timer" /etc/systemd/system/spulso-backup.timer
install -m 0644 "${APP_DIR}/ops/systemd/spulso-health-check.service" /etc/systemd/system/spulso-health-check.service
install -m 0644 "${APP_DIR}/ops/systemd/spulso-health-check.timer" /etc/systemd/system/spulso-health-check.timer
install -m 0644 "${APP_DIR}/ops/nginx/spulso-staging.conf" /etc/nginx/sites-available/spulso
ln -sfn /etc/nginx/sites-available/spulso /etc/nginx/sites-enabled/spulso
rm -f /etc/nginx/sites-enabled/spulso-staging /etc/nginx/sites-available/spulso-staging

systemctl daemon-reload
systemctl enable --now spulso-backup.timer spulso-health-check.timer
nginx -t
systemctl reload nginx

for _ in $(seq 1 60); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3101/health >/dev/null; then
    break
  fi
  sleep 2
done
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3101/health
printf '\nSPulso staging deployed at %s\n' \
  "$(runuser -u spulso -- git -C "${APP_DIR}" rev-parse --short HEAD)"
