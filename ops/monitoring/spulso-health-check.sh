#!/usr/bin/env bash
set -Eeuo pipefail

URL="${SPULSO_HEALTH_URL:-https://spulso.altaterraresources.com.pe/health}"
STATE_DIR="${SPULSO_MONITOR_STATE_DIR:-/var/lib/spulso-monitor}"
install -d -m 0700 "${STATE_DIR}"

response="$(curl --fail --silent --show-error --max-time 15 \
  --connect-timeout 5 "${URL}")" || {
  printf '%s health request failed: %s\n' "$(date -Is)" "${URL}" >&2
  exit 2
}

printf '%s' "${response}" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' || {
  printf '%s invalid health response\n' "$(date -Is)" >&2
  exit 2
}

date -Is > "${STATE_DIR}/last-success"
